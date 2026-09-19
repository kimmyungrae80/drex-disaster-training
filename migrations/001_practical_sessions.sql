-- 기존 연습훈련 테이블은 변경하지 않습니다.
create table if not exists public.practical_sessions (
  id uuid primary key,
  revision integer not null default 0,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.practical_sessions enable row level security;
revoke all on public.practical_sessions from anon, authenticated;
grant select, insert, update, delete on public.practical_sessions to service_role;
create index if not exists practical_sessions_expiry_idx on public.practical_sessions(expires_at);
-- 유효기간이 지난 세션은 별도 보관 정책에 따라 삭제할 수 있습니다.
-- delete from public.practical_sessions where expires_at < now();
