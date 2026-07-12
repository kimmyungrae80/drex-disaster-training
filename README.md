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
| 04 정량평가 | 2026 안전한국훈련 공식 평가지표(시군구, 20개 지표 100점+가점·감점) 기반 채점 |
| 05 Table-Top | 중대본·지대본·통합지원본부 3계층 + 불시메시지 6종 |
| 06 KPI 대시보드 | Supabase 연동 훈련 결과 누적 관리 |

---

## 📝 변경 이력

### v2.5.2 — OSM 실지도 폴백 (2026-07-11)

- 카카오맵 연결이 안 되는 환경을 위해 **OpenStreetMap 타일 지도** 추가 — **API 키·등록 불필요, 온라인이면 즉시 동작**
- 우선순위: 카카오(키 있으면) → OSM(키 불필요) → SVG 도식(오프라인) 자동 전환
- 지오코딩도 OSM Nominatim 폴백 (기관명 → 좌표, 무료)
- 위험구역·기관 마커·확대 모달·담당자 동기화 동일 지원, 줌 버튼(+/−) 내장, 외부 라이브러리 없음

### v2.5.1 — 실무 시나리오 3부 교차 검증 반영 (2026-07-11)

> 검증 표본: 괴산군(풍수해)·진천군(화학)·영동군(산불) 통합시나리오 + 옥천군·영동군 현장훈련 대본

- **위기경보 단계 트랙 신설** (관심→주의→경계→심각): 국면 연동 자동 전환·하향, 헤더 배지·환경 카드·담당자 화면 표시, 변동 시 상황일지 기록 — 3부 공통의 표준 축
- **지휘권 이양 자동 기록**: 수습 국면 진입 시 긴급구조통제단(소방) → 재난현장통합지원본부(부단체장)
- 총괄표에 위기경보·타임라인(H+) 행, 피해 누계 사망 분해 표기 (진천·영동 양식)
- AI 쟁점 생성 힌트에 실무 안건 보강 (위기경보 상향 결정, 유언비어·언론 대응, 긴급차량 근접 불가 등)
- 치명률 모델 실무 정합 확인: 진천 화학 7.5%·영동 산불 사망 0 — Beta 분포 범위 내

### v2.5 — Beta-Binomial 치명률 모델 (2026-07-11)

- 사망자 고정 배분(인명피해의 20%) 폐기 → **과거 사고 데이터 기반 2단계 몬테카를로**:
  사건 치명률 p~Beta(α,β) 추출 후 사망자~Binomial(N, p) — 사건 간 변동 재현, 시드 재현성 유지
- 유형별 보정 테이블(`TTX_FATALITY`, 근거 주석): 홍수 8%·지진 5%·산불 3%·화학 12%·감염병 2%·복합 10%
- 사망+실종+중상+경상 = 인명피해 총계 정합 보장, 시간 진행 사망도 p×0.5 확률 추출로 전환
- 표본 치명률을 시나리오 정보·총괄표에 표시, 현황판 "인명피해(사상자 총계)" 명시
- 검증(1만회): 홍수·중급 사망 중앙값 1명(절반은 0명) / 지진·고급 중앙값 2·P90 7명 — 실무 시나리오 규모감 정렬
- ※ 훈련 참여인원은 피해 수치와 무관 (AI 참고 정보로만 사용)

### v2.4.1 — 카카오맵 실지도 (2026-07-11)

- 훈련구역 상황도를 **카카오맵 실지도**로 전환 — 실제 훈련 지역(기관명 자동 지오코딩) 위에
  위험구역 원(국면·피해 연동 확산/수습)과 투입 기관 마커 오버레이
- 통제관·기관 담당자·확대 모달 모두 실지도, 담당자 내 기관 마커 강조 유지
- `KAKAO_JS_KEY` 환경변수 미설정·오프라인 시 기존 SVG 도식으로 자동 폴백 (총괄표 문서는 도식 유지)

### v2.4 — 훈련구역 상황도 (2026-07-11)

- **SVG 도식 상황도**: AI가 시나리오 생성 시 지역 특성 기반 훈련구역 배치(하천·도로·구역·시설·발생 지점)를 함께 생성
- 위험구역이 국면·피해와 연동해 확산/수습되고, 투입 기관 마커가 실시간 표시되는 살아있는 상황판(COP)
- 통제관: 중앙 상단 컴팩트 상시 표시 + 접기 + 클릭 확대(빔프로젝터 공유용 모달)
- 기관 담당자: 같은 상황도 동기화 + 내 기관 마커 청록 강조
- 총괄표 문서에 훈련 종료 시점 상황도 포함 — 외부 지도 API 없이 완전 자체 생성(오프라인 시연 가능)

### v2.3 — 다중 사용자 라이브 훈련 Phase 1 (2026-07-11)

- **역할 분리 로그인**: 통제관(관리자)은 통합훈련 시뮬레이션 전체를 운영, 협업기관 담당자는 세션 코드로 참여
- **세션 코드 참여**: 통제관이 훈련 시작 시 6자리 코드 발급 → 13개 기관 담당자가 코드+기관 선택으로 접속
- **기관 담당자 전용 UI**: 실시간 상황판(피해·환경·돌발 동기화) + 상태 변경 + SOP 조치 실행 + 자유 조치록
- **양방향 연동**: 담당자 조치가 통제관 화면(기관 카드·피해 수치·상황일지)에 실시간 반영,
  참여 기관은 자동 조치에서 제외 — 사람이 안 움직이면 그 기관은 정말 안 움직임
- 담당자 조치 기록이 총괄표 문서의 "협업기관 담당자 조치 기록" 시트로 자동 정리
- ⚠️ 최초 1회 Supabase 테이블 생성 필요: [docs/live-training.sql](docs/live-training.sql)

### v2.2 — 통합훈련 모드 (2026-07-11)

> 근거: 2025 괴산군 통합시나리오 구조 분석 + 2026 평가지표 2-1 토론기반 훈련

- **통합훈련 모드 신설** (기본): 라운드 = 상황판단회의 — 상황부여 메시지 2~4건(강도별) 순차 도착 + 핵심 의사결정. 훈련 시간 40~60분으로 실제 토론훈련 규모 재현 (신속 모드는 기존 15~25분 유지)
- **상황부여 메시지 시스템**: 발신처·조치 2안(적정/차선), 처리 시 관련기관 자동 출동, 품질 70%+적시성 30% 채점, 미처리 시 미조치 0점 — 규칙점수의 20% 반영
- **환경 전개 트랙**: 국면별 기상·위험지표(수위 등)·교통 상태 카드 + 국면 전환 일지 기록
- **통합시나리오 총괄표 다운로드**: 훈련 기록을 실무 양식 구조(총괄표·회의기록·기관운용·평가점검표)의 문서로 자동 생성 — 차년도 훈련 계획 초안으로 활용
- 2026 공식 평가지표(시군구) 모의평가 전면 반영 + TTX 종료 시 토론기반(2-1) 평가점검표 자동 생성

### v2.0 — 시뮬레이션 엔진 고도화 (2026-07-10)

> 설계 문서: [docs/UPGRADE-PLAN.md](docs/UPGRADE-PLAN.md)

**시뮬레이션 엔진**
- 시드 기반 PRNG(mulberry32) 도입 — 동일 시드 + 동일 조건 = 피해 샘플링·돌발 판정·RTO 분포 완전 재현 (사전/사후 비교 훈련 지원)
- 시간 진행 피해 모델 — 실시간 30초 = 재난시간 10분 틱, 재난유형별 진행 곡선(선형/지수/여진형), 기관 투입 억제율만큼 피해 증가 감쇠
- 가변 국면·라운드 시스템 — 고정 3단계 폐기. 강도별 3~6라운드 + 성과 분기(조기 안정화 시 라운드 단축·보너스, 피해 폭주 시 위기 라운드 강제 삽입)
- 혼합 채점 — 라운드 점수 = 규칙 60%(신속성·기관투입·위험관리·피해억제) + AI 평가 40%
- RTO 훈련 실적 연동 — 피해계수(실제 피해 증가율)·지연계수(평균 결정 소요시간) 반영

**AI 시나리오**
- 의사결정 맥락 누적 — 이전 라운드 결정 이력·직전 상황을 프롬프트에 전달, 라운드별 돌발상황 즉석 생성
- 시나리오 Validator — 필수 필드·MC 수치 일치·지역 태그 반영 로컬 검증, 위반 시 1회 재생성 + MC 값 강제 보정
- 선택지 다양화 — 위험도-라벨 고정 패턴 제거, PRNG 셔플로 메타게임 차단
- 지역 특성 태그 8종 (인구밀집·하천/해안·산간·산업단지·고령화·관광지·도서·지하공간)

**UI/시각화**
- 현황판 피해 추이 스파크라인 (기관 투입 마커, 호버 툴팁)
- 결과 화면: 의사결정 타임라인, 규칙점수 4요소 막대, RTO 몬테카를로 히스토그램(P50/P95)
- 상황일지 유형 필터 (의사결정/돌발/기관/시스템)
- 사용설명서 전면 갱신 + 훈련 운영 가이드(15장) 신설

### v1.x — MVP (2026-04 ~ 06)
- AI 시나리오 생성, SOP 13개 협업기관, 솔로 학습 모드, 다운로드 매뉴얼, Groq API 전환

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
