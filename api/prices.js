// Vercel Serverless Function — /api/prices
// Supabase에서 최신 시세/환율을 읽어 프론트에 반환.
// 외부 사이트(Trading Economics) 직접 fetch는 GitHub Actions cron이 담당.

import { fetchLatestData } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const data = await fetchLatestData();

    // Vercel Edge Cache: 5분 캐시 + 10분간 stale 응답 허용
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    res.status(200).json(data);
  } catch (error) {
    console.error("[api/prices] 실패:", error);
    res.status(503).json({
      error: "data source unavailable",
      message: error.message
    });
  }
}
