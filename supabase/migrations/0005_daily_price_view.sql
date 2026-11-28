-- 종목 × 날짜(UTC)별 1행만 보여주는 VIEW
-- price_snapshots에는 KOMIS 일별 행과 매시간 자동수집 행이 섞여 있어
-- 종목당 하루 여러 행이 쌓인다. Supabase는 요청당 1000행만 반환하므로
-- 차트 이력 조회(fetchHistoryBySymbol)가 중간에 잘렸다.
-- 이 VIEW는 하루 1행만 남긴다 → 1년 ≈ 250~366행, 요청 1번으로 끝.
--
-- 같은 날 여러 행이면: KOMIS 우선, 그다음 최신 collected_at
-- (lib/db.js의 dedupByDay와 같은 규칙)
--
-- 실행:
--   Supabase 대시보드 → SQL Editor → New query → 본 파일 내용 붙여넣기 → Run

create or replace view daily_price_per_symbol as
select distinct on (symbol, (collected_at at time zone 'UTC')::date)
  id,
  symbol,
  usd_per_kg,
  source,
  collected_at
from price_snapshots
order by
  symbol,
  (collected_at at time zone 'UTC')::date,
  (source = 'KOMIS (광해광업공단)') desc,
  collected_at desc;

-- VIEW는 underlying table의 RLS 정책을 그대로 따르므로
-- price_snapshots의 "public read prices" 정책으로 anon 키 SELECT 가능.
-- 별도 정책 추가 불필요. (0003과 동일)

-- 검증 쿼리 (실행 후 확인용): 종목별 행 수와 마지막 날짜
-- select symbol, count(*) as days, max(collected_at) as last_day
-- from daily_price_per_symbol
-- group by symbol
-- order by symbol;
