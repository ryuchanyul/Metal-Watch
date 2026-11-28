// Ba 등 수동 입력 종목의 가격을 price_snapshots에 추가.
//
// 보안 포지션: 공개 엔드포인트 (사용자 요구).
// - 2명 사용자용 폐쇄 환경
// - SANITY_RANGE 가드로 극단값 차단 (가격 외 다른 영향 없음)
// - symbol 화이트리스트로 Ba만 허용
//
// 요청: POST { symbol: 'Ba', usd_per_kg: 27.5, note?: '2026 Q4' }

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

// 수동 입력 허용 심볼
const ALLOWED_SYMBOLS = new Set(["Ba"]);

// 심볼별 상식 범위 — scripts/backfill-all-komis.js의 SANITY_RANGE와 동기화 필수
const SANITY_RANGE = {
  Ba: [5, 50]
};

const MANUAL_SOURCE = "Manual";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "서버 설정이 완료되지 않았습니다." });
  }

  const body = req.body || {};
  const symbol = String(body.symbol || "").trim();
  const price = Number(body.usd_per_kg);
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;

  // 검증 1: 심볼 화이트리스트
  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return res.status(400).json({
      error: `symbol은 ${[...ALLOWED_SYMBOLS].join(", ")} 중 하나여야 합니다.`
    });
  }

  // 검증 2: 양수 유한값
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "유효한 양수 가격이 필요합니다." });
  }

  // 검증 3: 상식 범위 가드
  const range = SANITY_RANGE[symbol];
  if (range && (price < range[0] || price > range[1])) {
    return res.status(422).json({
      error: `가격이 상식 범위 $${range[0]}~$${range[1]}을 벗어났습니다. 다시 확인해 주세요.`,
      range
    });
  }

  // DB insert
  const row = {
    symbol,
    usd_per_kg: price,
    raw_value: price,
    raw_unit: "USD/kg",
    source: MANUAL_SOURCE,
    collected_at: new Date().toISOString()
  };

  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/price_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(row)
  });

  if (!dbRes.ok) {
    const detail = await dbRes.text().catch(() => "");
    console.error("[manual/update] Supabase insert 실패:", dbRes.status, detail);
    return res.status(502).json({
      error: "저장에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요."
    });
  }

  const inserted = await dbRes.json().catch(() => null);
  return res.status(200).json({
    ok: true,
    inserted: Array.isArray(inserted) ? inserted[0] : inserted,
    note
  });
}
