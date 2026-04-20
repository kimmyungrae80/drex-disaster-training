# DREX — 재난훈련 시뮬레이션 플랫폼

> AI 기반 재난훈련 시나리오 생성 · SOP 디지털 전환 · RTO 정량평가 · Table-Top 훈련 · KPI 대시보드

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E)](https://supabase.com)
[![Claude AI](https://img.shields.io/badge/AI-Claude%20Sonnet-orange)](https://anthropic.com)

---

## 📋 프로젝트 개요

DREX(Disaster Response EXercise)는 공공기관 및 지방자치단체의 재난훈련을 AI 기반으로 혁신하는 플랫폼입니다.

| 모듈 | 기능 |
|------|------|
| 01 AI 시나리오 | Claude AI가 행안부 표준 양식(5단계)으로 훈련 시나리오 자동 생성 |
| 02 SOP 실행구조 | 재난현장조치 행동매뉴얼 13개 협업기능 디지털화 |
| 03 RTO 산출 | BIA-AHP 가중치 기반 복구목표시간 정량 산출 |
| 04 정량평가 | 2025 안전한국훈련 평가지표(90점) 자동 채점 |
| 05 Table-Top | 중대본·지대본·통합지원본부 3계층 + 불시메시지 6종 |
| 06 KPI 대시보드 | Supabase 연동 훈련 결과 누적 관리 |

---

## 🚀 배포 방법

### 1. Supabase 세팅

[supabase.com](https://supabase.com) → New Project 생성 후 SQL Editor에서 아래 실행:

```sql
-- 훈련 세션 결과 테이블
create table drex_sessions (
  id uuid default gen_random_uuid() primary key,
  disaster_type text,
  region text,
  elapsed_sec int,
  decision_delay int,
  flash_penalty int,
  final_rto int,
  grade text,
  spm_count int,
  avg_fire int,
  avg_police int,
  avg_medical int,
  created_at timestamptz default now()
);

-- 정량평가 결과 테이블
create table drex_evaluations (
  id uuid default gen_random_uuid() primary key,
  score numeric,
  grade text,
  created_at timestamptz default now()
);

-- Row Level Security (공개 읽기/쓰기 허용)
alter table drex_sessions enable row level security;
alter table drex_evaluations enable row level security;

create policy "allow_all_drex_sessions"
  on drex_sessions for all using (true) with check (true);

create policy "allow_all_drex_evaluations"
  on drex_evaluations for all using (true) with check (true);
```

### 2. index.html에 Supabase 키 입력

`index.html` 상단 두 줄을 실제 값으로 교체:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';   // ← 실제 URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // ← anon key
```

**Supabase 키 위치:** Project Settings → API → Project URL & anon public key

### 3. GitHub 업로드

```bash
git init
git add .
git commit -m "feat: DREX MVP 초기 배포"
git remote add origin https://github.com/YOUR_USERNAME/drex-disaster-training.git
git branch -M main
git push -u origin main
```

### 4. Vercel 배포

1. [vercel.com](https://vercel.com) → Add New Project
2. GitHub 레포 `drex-disaster-training` 선택
3. Framework Preset: **Other**
4. **Deploy** 클릭
5. 배포 완료 → URL 공유 가능

---

## 🗂️ 파일 구조

```
drex-disaster-training/
├── index.html        # 메인 앱 (전체 기능 단일 파일)
├── vercel.json       # Vercel 배포 설정
└── README.md         # 이 파일
```

---

## 🔧 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | HTML / CSS / Vanilla JS (단일 파일) |
| AI | Claude Sonnet API (Anthropic) |
| Database | Supabase (PostgreSQL) |
| 배포 | Vercel (정적 호스팅) |
| 버전관리 | GitHub |

---

## 📊 Supabase KPI 데이터 구조

### drex_sessions (훈련 결과)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| disaster_type | text | 재난 유형 (flood/earthquake/fire/chemical) |
| region | text | 훈련 지역 |
| elapsed_sec | int | 훈련 총 소요 시간(초) |
| decision_delay | int | 의사결정 지연 합계(분) |
| flash_penalty | int | 불시메시지 패널티(분) |
| final_rto | int | 최종 추정 RTO(분) |
| grade | text | 종합 등급 (우수/보통/개선필요) |
| spm_count | int | 상황판단회의 횟수 |
| avg_fire | int | 소방서 평균 행동시간(분) |
| avg_police | int | 경찰서 평균 행동시간(분) |
| avg_medical | int | 보건소 평균 행동시간(분) |

### drex_evaluations (정량평가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| score | numeric | 평가 점수 (0~90) |
| grade | text | 등급 (우수/보통/미흡) |

---

## 🛠️ 향후 로드맵

- [ ] 다중 사용자 실시간 협업 (Supabase Realtime)
- [ ] 훈련 결과 PDF 자동 생성
- [ ] 지자체별 멀티테넌트 계정 분리
- [ ] 모바일 앱 (React Native)
- [ ] 훈련 영상 녹화 연동

---

## 👤 개발자

**김명래 (Myungrae Kim)**
- 소속: (사)한국재난안전관리연구소
- 학위: 방재공학 박사 (충북대, 2026)
- 이메일: kimmyungrae80@gmail.com

---

## 📄 라이선스

본 프로젝트는 연구 목적으로 개발되었습니다.
