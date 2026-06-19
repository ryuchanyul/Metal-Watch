-- 분석표 결과 저장 테이블
-- 시험성적서 OCR + 사용자 검증/수정 후 최종 결과를 저장.
-- 향후 재고 관리 + ERP 연계 시 이 테이블 행을 source로 사용.

create table if not exists analysis_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 시료 메타 정보 (OCR 추출 + 사용자 수정)
  sample_name text,
  report_number text,
  test_date date,
  issuer text,
  ocr_confidence numeric,

  -- 저장 시점 시세/환율 스냅샷 (시세가 바뀌어도 분석 시점 기록 보존)
  exchange_rate_snapshot numeric,
  prices_snapshot jsonb,    -- { "Ni": 19.02, "Ti": 4.54 }

  -- 양쪽 탭(A/B) 데이터 + 계산 결과
  tabs jsonb not null,      -- { A: {metals, moisture, payRates, totalQty, results}, B: {...} }

  -- 사용자 메모
  notes text,

  -- 향후 ERP 연계용 필드 (지금은 default값)
  erp_status text not null default 'draft', -- draft | confirmed | in_stock | out_of_stock
  inventory_id uuid                          -- 재고 항목과 link (다음 단계)
);

-- 조회 인덱스
create index if not exists idx_analysis_records_created_at
  on analysis_records (created_at desc);

create index if not exists idx_analysis_records_sample_name
  on analysis_records (sample_name);

create index if not exists idx_analysis_records_erp_status
  on analysis_records (erp_status);

-- 자동 updated_at 갱신 트리거
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_analysis_records_updated_at on analysis_records;
create trigger trg_analysis_records_updated_at
  before update on analysis_records
  for each row execute function set_updated_at();

-- RLS: 일단 service_role만 접근 (public 조회 불필요)
alter table analysis_records enable row level security;

-- service_role은 RLS 우회. 별도 policy 불필요.
-- 향후 사용자별 권한 추가 시 policy 작성 예정.

comment on table analysis_records is '시험성적서 분석 결과 저장 — 재고/ERP 연계 source';
comment on column analysis_records.tabs is '습식 A/B 탭 별 metals, moisture, payRates, totalQty, results';
comment on column analysis_records.prices_snapshot is '저장 시점 메탈별 USD/kg 시세';
comment on column analysis_records.erp_status is 'draft → confirmed → in_stock → out_of_stock';
