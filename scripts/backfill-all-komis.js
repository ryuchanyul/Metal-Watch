// 모든 KOMIS 일별 데이터를 Supabase에 통합 적재.
// 기존 KOMIS source 행 + 옛 manual estimate 행 삭제 후 재적재 (멱등).
//
// JSON 형식: [["YYYY-MM-DD", usd_per_kg, raw_value], ...]

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const KOMIS_SOURCE = "KOMIS (광해광업공단)";
const OLD_MANUAL_SOURCE = "Manual estimate (chart)";
const CHUNK_SIZE = 500;

// ⚠️ Sanity 가드: 각 심볼의 상식적 USD/kg 범위 (최소, 최대).
//   JSON 최근 7일 중앙값이 이 범위를 벗어나면 적재 중단.
//   목적: convert-komis-xlsx.py의 factor 설정 오류(단위 환산 누락) 같은 1000배 사고 즉시 감지.
//   Co 사고 재현 테스트: factor=1.0이면 중앙값 $35,450 → Co 범위 [5, 300] 초과 → 즉시 중단.
//   범위는 과거 10년 가격 변동을 넉넉히 포함하는 수준. 실가격이 벗어나는 날이 오면 숫자만 수정.
const SANITY_RANGE = {
  Li:    [1, 150],      // 탄산리튬
  Co:    [5, 300],      // 코발트 (2026-11 $46)
  Mn:    [0.3, 10],     // 금속망간
  Ni:    [3, 50],       // 니켈
  Cu:    [3, 30],       // 동
  Al:    [1, 10],       // 알루미늄
  Sn:    [10, 100],     // 주석
  Zn:    [1, 10],       // 아연
  Pb:    [0.5, 5],      // 연
  Mo:    [10, 200],     // 몰리브덴
  W_WC:  [10, 200],     // 텅스텐 WC
  W_WO3: [10, 200],     // 텅스텐 WO3
  Au:    [30000, 300000],  // 금 (현 $140,000)
  Ag:    [300, 5000],      // 은
  Pd:    [15000, 150000],  // 팔라듐
  Mg:    [1, 30],       // 마그네슘
  Ti:    [3, 100],      // 티타늄
  In:    [100, 2000],   // 인듐
  Ba:    [5, 50]        // 바륨 — 수동 입력 전용 (api/manual/update.js에서도 동일 범위 사용)
};

async function sendSanityAlert(symbol, median, range) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const text =
    `🚫 [Metal Watch KOMIS 가드] 적재 중단\n\n` +
    `${symbol}: 최근 7일 중앙값 $${median.toFixed(2)}/kg이 상식 범위 $${range[0]}~$${range[1]}을 벗어남.\n\n` +
    `원인 후보:\n` +
    `  1) convert-komis-xlsx.py의 factor 설정 오류 (단위 환산 누락)\n` +
    `  2) KOMIS 원본 xlsx의 데이터 오류\n` +
    `  3) 실제 가격이 역사적 범위를 벗어난 급변 (범위 상수 수정 필요)\n\n` +
    `점검 필수. 수정 전에는 DB에 적재되지 않음.`;
  const params = new URLSearchParams();
  params.set("chat_id", TELEGRAM_CHAT_ID);
  params.set("text", text);
  params.set("disable_web_page_preview", "true");
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }
  ).catch((e) => console.warn("[가드] 텔레그램 전송 실패:", e.message));
}

function checkSanity(symbol, points) {
  const range = SANITY_RANGE[symbol];
  if (!range) return { ok: true }; // 등록되지 않은 심볼은 통과 (호환성)
  // 최근 7일 데이터 추출 → 중앙값 (단일 포인트 노이즈 완화)
  const recent = points.slice(-7).map((p) => Number(p[1])).filter(Number.isFinite);
  if (recent.length === 0) return { ok: true };
  const sorted = [...recent].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median < range[0] || median > range[1]) {
    return { ok: false, median, range };
  }
  return { ok: true, median };
}

// 파일명 → DB 심볼 + 원본 단위
const SYMBOLS = [
  { file: "li",    db: "Li",    rawUnit: "USD/kg" },
  { file: "co",    db: "Co",    rawUnit: "USD/MT" }, // 2026-11-28 USD/kg에서 수정
  { file: "mn",    db: "Mn",    rawUnit: "USD/mt" },
  { file: "ni",    db: "Ni",    rawUnit: "USD/ton" },
  { file: "cu",    db: "Cu",    rawUnit: "USD/ton" },
  { file: "al",    db: "Al",    rawUnit: "USD/ton" },
  { file: "sn",    db: "Sn",    rawUnit: "USD/ton" },
  { file: "zn",    db: "Zn",    rawUnit: "USD/ton" },
  { file: "pb",    db: "Pb",    rawUnit: "USD/ton" },
  { file: "mo",    db: "Mo",    rawUnit: "USD/mt" },
  { file: "w_wc",  db: "W_WC",  rawUnit: "USD/kg" },
  { file: "w_wo3", db: "W_WO3", rawUnit: "USD/kg" },
  { file: "au",    db: "Au",    rawUnit: "USD/oz" },
  { file: "ag",    db: "Ag",    rawUnit: "USD/oz" },
  { file: "pd",    db: "Pd",    rawUnit: "USD/oz" },
  { file: "mg",    db: "Mg",    rawUnit: "USD/T" },
  { file: "ti",    db: "Ti",    rawUnit: "USD/kg" },
  { file: "in",    db: "In",    rawUnit: "USD/kg" }
];

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, "data");

async function deleteRowsBySource(source) {
  const url =
    `${SUPABASE_URL}/rest/v1/price_snapshots?source=eq.${encodeURIComponent(source)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    }
  });
  if (!res.ok) {
    throw new Error(`삭제 실패 (${source}): ${res.status} ${await res.text()}`);
  }
  console.log(`[정리] source='${source}' 행 삭제`);
}

async function insertChunk(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/price_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    throw new Error(`insert 실패: ${res.status} ${await res.text()}`);
  }
}

async function loadAndInsertOne({ file, db, rawUnit }) {
  const path = join(DATA_DIR, `${file}-komis.json`);
  const raw = await readFile(path, "utf-8");
  const points = JSON.parse(raw); // [[date, usd_per_kg, raw_value], ...]

  // ⚠️ Sanity 가드: 범위 벗어나면 적재 거부 + 예외 발생 → 전체 백필 중단
  const check = checkSanity(db, points);
  if (!check.ok) {
    console.error(
      `[가드] ${db} 범위 초과: 중앙값 $${check.median.toFixed(2)}, 범위 $${check.range[0]}~$${check.range[1]}`
    );
    await sendSanityAlert(db, check.median, check.range);
    throw new Error(
      `[가드] ${db}: 최근 7일 중앙값 $${check.median.toFixed(2)}가 상식 범위 $${check.range[0]}~$${check.range[1]}을 벗어남. 적재 중단.`
    );
  }

  const rows = points.map(([date, usdPerKg, rawValue]) => ({
    symbol: db,
    usd_per_kg: Number(usdPerKg),
    raw_value: Number(rawValue),
    raw_unit: rawUnit,
    source: KOMIS_SOURCE,
    collected_at: new Date(date + "T00:00:00Z").toISOString()
  }));

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await insertChunk(rows.slice(i, i + CHUNK_SIZE));
  }
  console.log(`[적재] ${db}: ${rows.length}행`);
  return rows.length;
}

async function main() {
  console.log(`[백필 시작] KOMIS 통합 (${SYMBOLS.length} 종목)`);

  // 기존 행 정리 (멱등)
  await deleteRowsBySource(KOMIS_SOURCE);
  await deleteRowsBySource(OLD_MANUAL_SOURCE);

  let total = 0;
  for (const sym of SYMBOLS) {
    total += await loadAndInsertOne(sym);
  }

  console.log(`[백필 완료] 총 ${total}행 적재 @ ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[백필 실패]", error);
  process.exit(1);
});
