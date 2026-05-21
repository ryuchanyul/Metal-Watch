-- Vercel Function이 anon 키로 시세를 SELECT 할 수 있게 RLS 정책 추가.
-- INSERT/UPDATE/DELETE는 여전히 service_role 키만 가능 (RLS bypass).
--
-- 실행 위치: Supabase 대시보드 → SQL Editor → New query
-- 실행 후 좌측 Authentication → Policies에서 두 정책이 보이면 성공.

create policy "public read prices"
  on price_snapshots
  for select
  using (true);

create policy "public read fx"
  on fx_snapshots
  for select
  using (true);
