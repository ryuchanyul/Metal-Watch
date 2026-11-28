// GET /api/analysis/list?limit=50&offset=0
// Supabase analysis_records 목록 최신순 반환.
// 인증: HttpOnly 세션 쿠키 HMAC 검증 (lib/session.js)

import { verifySessionCookie, isAllowedOrigin } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_TOKEN) {
    return res.status(500).json({ error: "서버 설정 미완료" });
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: "허용되지 않은 출처입니다." });
  }
  if (!verifySessionCookie(req, ADMIN_TOKEN)) {
    return res.status(401).json({ error: "세션이 없거나 만료되었습니다. 페이지를 새로고침해 주세요." });
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
