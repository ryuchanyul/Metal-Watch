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

// 파일명 → DB 심볼 + 원본 단위
const SYMBOLS = [
  { file: "li",    db: "Li",    rawUnit: "USD/kg" },
  { file: "co",    db: "Co",    rawUnit: "USD/kg" },
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
  { file: "ag",    db: "Ag",    rawUnit: "USD/oz" }
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
