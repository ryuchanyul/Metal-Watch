// GET /api/history?symbol=Cu
// 특정 종목의 전체 시계열을 Supabase에서 SELECT하여 반환.

import { fetchHistoryBySymbol } from "../lib/db.js";

export default async function handler(req, res) {
  const symbol = req.query?.symbol;

  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "symbol query parameter required" });
    return;
  }

  try {
    const rows = await fetchHistoryBySymbol(symbol);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=1200"
    );
    res.status(200).json({
      symbol,
      rows,
      count: rows.length,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[api/history] ${symbol} 실패:`, error);
    res.status(503).json({
      error: "data source unavailable",
      symbol,
      message: error.message
    });
  }
}
