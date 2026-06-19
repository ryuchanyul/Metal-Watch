// GET /api/analysis/list?limit=50&offset=0
// Supabase analysis_records 목록 최신순 반환.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  const offset = Math.max(Number(req.query?.offset) || 0, 0);

  try {
    const url = `${SUPABASE_URL}/rest/v1/analysis_records?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    const supaRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "count=exact"
      }
    });

    if (!supaRes.ok) {
      const errText = await supaRes.text();
      return res.status(502).json({
        error: "Supabase fetch failed",
        status: supaRes.status,
        message: errText.substring(0, 500)
      });
    }

    const records = await supaRes.json();
    const contentRange = supaRes.headers.get("content-range") || "";
    const totalMatch = contentRange.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : records.length;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ records, total, limit, offset });
  } catch (error) {
    console.error("[analysis/list] 실패:", error);
    return res.status(500).json({ error: error.message });
  }
}
