// fetchHistoryBySymbol 검증:
//  - 일별 VIEW가 있으면 VIEW만 조회한다
//  - VIEW가 없으면 원본 테이블로 fallback하고, 1000행 제한을 넘어도 끝까지 읽는다
// 실행: node --test tests/history-pagination.test.js

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

const { fetchHistoryBySymbol } = await import("../lib/db.js");

const VIEW = "daily_price_per_symbol";
const TABLE = "price_snapshots";

// 하루 1행씩 total일치 가짜 데이터. 서버처럼 요청당 최대 1000행만 돌려준다.
// hasView=false면 VIEW 요청에 404를 돌려준다 (마이그레이션 0005 실행 전 상태).
function mockSupabase(total, { hasView }) {
  const start = Date.UTC(2020, 0, 1);
  const table = Array.from({ length: total }, (_, i) => ({
    usd_per_kg: i,
    collected_at: new Date(start + i * 86400000).toISOString(),
    source: "KOMIS (광해광업공단)"
  }));
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    const resource = u.pathname.split("/").pop();
    const params = u.searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 1000), 1000);
    const offset = Number(params.get("offset") ?? 0);
    calls.push({ resource, limit, offset, since: params.get("collected_at") });
    if (resource === VIEW && !hasView) {
      return { ok: false, status: 404, text: async () => "not found" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => table.slice(offset, offset + limit)
    };
  };
  return { table, calls };
}

test("VIEW가 있으면 VIEW만 한 번 조회한다", async () => {
  const { table, calls } = mockSupabase(366, { hasView: true });
  const rows = await fetchHistoryBySymbol("Li");
  assert.equal(rows.length, 366);
  assert.equal(rows.at(-1).collected_at, table.at(-1).collected_at);
  assert.deepEqual(calls.map((c) => c.resource), [VIEW]);
});

test("VIEW가 없으면 테이블로 fallback하고 1000행 넘는 이력을 끝까지 읽는다", async () => {
  const { table, calls } = mockSupabase(2500, { hasView: false });
  const rows = await fetchHistoryBySymbol("Li");
  assert.equal(rows.length, 2500);
  assert.equal(rows.at(-1).collected_at, table.at(-1).collected_at);
  assert.deepEqual(calls.map((c) => c.resource), [VIEW, TABLE, TABLE, TABLE]);
});

test("정확히 1000행이면 빈 페이지를 한 번 더 읽고 끝낸다", async () => {
  const { calls } = mockSupabase(1000, { hasView: true });
  const rows = await fetchHistoryBySymbol("Li");
  assert.equal(rows.length, 1000);
  assert.equal(calls.length, 2);
});

test("최근 366일만 조회하도록 날짜 필터를 보낸다", async () => {
  const { calls } = mockSupabase(10, { hasView: true });
  await fetchHistoryBySymbol("Li");
  const match = /^gte\.(.+)$/.exec(calls[0].since ?? "");
  assert.ok(match, "collected_at=gte.<날짜> 필터가 있어야 한다");
  const daysBack = (Date.now() - new Date(match[1]).getTime()) / 86400000;
  assert.ok(Math.abs(daysBack - 366) < 0.01, `366일 전이어야 한다: ${daysBack}`);
});
