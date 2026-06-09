-- 종목 × source 조합별 가장 최근 1행만 보여주는 VIEW
-- fetchLatestPrices의 limit 의존 제거 — 종목 수가 늘어나도 안전.
--
-- 실행:
--   Supabase 대시보드 → SQL Editor → New query → 본 파일 내용 붙여넣기 → Run

create or replace view latest_price_per_symbol_source as
select distinct on (symbol, source)
  symbol,
  usd_per_kg,
  raw_value,
  raw_unit,
  source,
  collected_at
from price_snapshots
order by symbol, source, collected_at desc;

-- VIEW는 underlying table의 RLS 정책을 그대로 따르므로
-- price_snapshots의 "public read prices" 정책으로 anon 키 SELECT 가능.
-- 별도 정책 추가 불필요.

-- 검증 쿼리 (실행 후 확인용):
-- select symbol, source, collected_at, usd_per_kg
-- from latest_price_per_symbol_source
-- order by symbol, source;
