// Cobalt 1년치 근사 데이터를 Supabase에 적재.
// Trading Economics 차트 이미지에서 사용자 검토 후 결정된 18개 포인트.
// source 컬럼: "Manual estimate (chart)" — 자동 수집과 구분.

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_KEY 모두 필요합니다.");
  process.exit(1);
}

const MANUAL_SOURCE = "Manual estimate (chart)";

// (date, USD/T)
const COBALT_POINTS = [
  ["2025-05-21", 33378.4],
  ["2025-06-21", 33378.4],
  ["2025-07-21", 33378.4],
  ["2025-08-21", 33378.4],
  ["2025-09-21", 33500],
  ["2025-10-01", 34000],
  ["2025-10-15", 42500],
  ["2025-10-31", 48000],
  ["2025-11-15", 49500],
  ["2025-11-30", 50500],
  ["2025-12-15", 53500],
  ["2025-12-31", 55000],
  ["2026-01-15", 55800],
  ["2026-01-31", 56200],
  ["2026-02-21", 56290],
  ["2026-03-21", 56290],
  ["2026-04-21", 56290],
  ["2026-05-20", 56290]
];

async function clearPreviousManual() {
  const url =
    `${SUPABASE_URL}/rest/v1/price_snapshots` +
    `?symbol=eq.Co&source=eq.${encodeURIComponent(MANUAL_SOURCE)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    }
  });
  if (!res.ok) {
    throw new Error(`기존 manual 백필 삭제 실패: ${res.status} ${await res.text()}`);
  }
  console.log(`[정리] Co + source='${MANUAL_SOURCE}' 행 삭제 완료`);
}

async function insertRows(rows) {
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
    throw new Error(`Supabase insert 실패: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  console.log(`[백필 시작] Cobalt manual, ${COBALT_POINTS.length}개 포인트`);

  await clearPreviousManual();

  const rows = COBALT_POINTS.map(([date, usdPerT]) => ({
    symbol: "Co",
    usd_per_kg: Number((usdPerT / 1000).toFixed(4)),
    raw_value: usdPerT,
    raw_unit: "USD/T",
    source: MANUAL_SOURCE,
    collected_at: new Date(date + "T00:00:00Z").toISOString()
  }));

  await insertRows(rows);

  console.log(`[적재] ${rows.length}행 완료`);
  console.log(`[백필 완료] ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[백필 실패]", error);
  process.exit(1);
});
