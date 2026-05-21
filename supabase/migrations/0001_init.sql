-- Metal Watch 초기 스키마
-- 실행 방법:
--   1. Supabase 프로젝트 생성 (https://supabase.com)
--   2. 좌측 메뉴 → SQL Editor → New query
--   3. 본 파일 내용 전체 복사하여 실행

-- ─────────────────────────────────────────────
-- 시세 스냅샷: 매시간 1품목당 1행씩 누적
-- ─────────────────────────────────────────────
create table if not exists price_snapshots (
  id            bigserial primary key,
  symbol        text not null,            -- 예: 'Co', 'Cu', 'Li'
  usd_per_kg    numeric,                  -- 정규화 가격
  raw_value     numeric,                  -- 원본 값 (예: 56290)
  raw_unit      text,                     -- 원본 단위 (예: 'USD/T')
  source        text,                     -- 'Trading Economics' 등
  collected_at  timestamptz not null default now()
);

create index if not exists price_snapshots_symbol_time
  on price_snapshots (symbol, collected_at desc);

-- ─────────────────────────────────────────────
-- 환율 스냅샷
-- ─────────────────────────────────────────────
create table if not exists fx_snapshots (
  id            bigserial primary key,
  pair          text not null,            -- 'USD_KRW', 'USD_CNY'
  rate          numeric not null,
  collected_at  timestamptz not null default now()
);

create index if not exists fx_snapshots_pair_time
  on fx_snapshots (pair, collected_at desc);

-- ─────────────────────────────────────────────
-- 행 수준 보안 (Row Level Security)
--   • Service Role Key는 RLS를 우회하므로 GitHub Actions에서 무리없이 insert.
--   • 추후 프론트에서 anon 키로 SELECT만 허용하려면 별도 정책 추가.
-- ─────────────────────────────────────────────
alter table price_snapshots enable row level security;
alter table fx_snapshots enable row level security;

-- 읽기 전용 공개 정책 (필요 시 활성화)
-- create policy "public read prices" on price_snapshots
--   for select using (true);
-- create policy "public read fx" on fx_snapshots
--   for select using (true);
