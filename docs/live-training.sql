-- ═══════════════════════════════════════════════════════════
-- DREX 다중 사용자 라이브 훈련 (Phase 1) — Supabase 테이블
-- 실행: Supabase 콘솔 → SQL Editor에 붙여넣고 Run
-- ═══════════════════════════════════════════════════════════

-- 훈련 세션 (통제관이 생성, 상황 스냅샷의 정본)
create table if not exists ttx_live_sessions (
  code        text primary key,          -- 6자리 세션 코드
  org         text,                      -- 훈련 기관
  disaster    text,                      -- 재난 유형
  status      text default 'running',    -- running | ended
  snapshot    jsonb,                     -- 상황 스냅샷 (라운드·피해·환경 등)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 기관 담당자 조치 기록
create table if not exists ttx_agency_actions (
  id           bigint generated always as identity primary key,
  session_code text not null,
  agency_id    text not null,            -- fire, police, ... (13개)
  agency_name  text,
  actor_name   text,                     -- 담당자 이름
  action_type  text not null,            -- join | sop | note | status
  action_text  text,
  status       text,                     -- 상태 변경 시: 출동중/현장투입/완료
  created_at   timestamptz default now()
);

create index if not exists idx_agency_actions_session
  on ttx_agency_actions (session_code, id);

-- RLS: 훈련 데이터는 민감도 낮음 — 세션 코드가 사실상 접근 제어
alter table ttx_live_sessions enable row level security;
alter table ttx_agency_actions enable row level security;

create policy "allow_all_live_sessions"
  on ttx_live_sessions for all using (true) with check (true);

create policy "allow_all_agency_actions"
  on ttx_agency_actions for all using (true) with check (true);
