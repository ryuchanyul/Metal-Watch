// POST /api/analysis/save
// 분석표 결과를 Supabase analysis_records 테이블에 저장.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const body = req.body || {};
  const {
    sample_name,
    report_number,
    test_date,
    issuer,
    ocr_confidence,
    exchange_rate_snapshot,
    prices_snapshot,
    tabs,
    notes
  } = body;

  if (!tabs || typeof tabs !== "object") {
    return res.status(400).json({ error: "tabs object required" });
  }

  const row = {
    sample_name: sample_name || null,
    report_number: report_number || null,
    test_date: test_date || null,
    issuer: issuer || null,
    ocr_confidence: ocr_confidence ?? null,
    exchange_rate_snapshot: exchange_rate_snapshot ?? null,
    prices_snapshot: prices_snapshot ?? null,
    tabs,
    notes: notes || null,
    erp_status: "draft"
  };

  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/analysis_records`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(row)
    });

    if (!supaRes.ok) {
      const errText = await supaRes.text();
      console.error("[analysis/save] Supabase error:", supaRes.status, errText);
      return res.status(502).json({
        error: "Supabase insert failed",
        status: supaRes.status,
        message: errText.substring(0, 500)
      });
    }

    const inserted = await supaRes.json();
    return res.status(200).json({
      ok: true,
      id: inserted[0]?.id,
      record: inserted[0]
    });
  } catch (error) {
    console.error("[analysis/save] 실패:", error);
    return res.status(500).json({ error: error.message });
  }
}
