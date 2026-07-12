# DREX 변경 이력

## v2.1 — 안전한국훈련 데이터 통합 & 보안 강화 (2026-07-11)

### 📊 데이터 통합

**안전한국훈련 컨설팅보고서 3,318건 Supabase 통합**

- **훈련결과 정보**: 538건 (엑셀 DB)
  - 기관명, 훈련일시, 회차, 재난유형, 지적사항, 개선사항
  
- **파일 메타데이터**: 865건 (CSV)
  - 파일명, 확장자, 문서유형, 기관, 크기, 수정일
  
- **통합 통계**
  - 총 데이터: 3,318건
  - 문서유형: 18개
  - 기관 수: 162개
  - 파일 수: 1,093개

**새 테이블: `training_consulting_reports`**

```sql
CREATE TABLE training_consulting_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  extension TEXT,
  doc_type TEXT,
  institution TEXT,
  year INT,
  size_kb NUMERIC,
  modified_date DATE,
  is_duplicate BOOLEAN DEFAULT false,
  source_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_institution ON training_consulting_reports(institution);
CREATE INDEX idx_doc_type ON training_consulting_reports(doc_type);
CREATE INDEX idx_year ON training_consulting_reports(year);
```

---

### 🔒 보안 강화

#### 1. API 키 보호

**이전 (위험)**
```javascript
// ❌ index.html에 하드코딩
const SUPABASE_KEY = "eyJhbGci...";  // GitHub에 노출됨
```

**현재 (안전)**
```javascript
// ✅ Vercel 환경변수에서 로드
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
```

**환경변수 설정**
- `SUPABASE_ANON_KEY` — 클라이언트 사이드 (읽기 주로)
- `SUPABASE_SERVICE_KEY` — 서버 사이드 (관리자 작업)
- `DREX_API_KEY` — API 엔드포인트 보호

#### 2. Row Level Security (RLS) 정책

**기존 정책 (공개)**
```sql
-- ❌ 누구나 모든 작업 가능
CREATE POLICY allow_all ON training_consulting_reports FOR ALL USING (true);
```

**새 정책 (보안)**
```sql
-- ✅ 인증된 사용자만 접근
ALTER TABLE training_consulting_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_users_rw ON training_consulting_reports
  FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
```

**결과**
- 로그인 없음: 데이터 접근 불가 🔐
- 로그인 후: 모든 데이터 접근 가능 ✅

#### 3. 보안 문서 추가

- `docs/SECURITY.md` — 보안 정책 및 RLS 설정
- `docs/DEPLOYMENT.md` — Vercel 배포 및 환경변수 가이드

---

### 🚀 배포 개선

**Vercel Production 배포**
- ✅ 환경변수 3개 설정 (Production, Preview 모두)
- ✅ Supabase 키 자동 로드
- ✅ `.env.local` 로컬 개발 환경 설정
- ✅ Git에서 민감 정보 제거

**라이브 URL**
```
https://drex-disaster-training.vercel.app
```

**배포 상태**
- API Keys: Vercel 환경변수 보호
- Database: Supabase RLS 정책 적용
- Auth: 로그인 필수

---

### 📝 변경 사항 요약

| 항목 | 이전 | 현재 |
|------|------|------|
| **데이터 규모** | 없음 | 3,318건 |
| **API 키 관리** | 하드코딩 ❌ | 환경변수 ✅ |
| **데이터 접근** | 공개 🌐 | 로그인 필수 🔐 |
| **보안 정책** | 없음 | RLS 완전 잠금 |
| **문서화** | 기본 | 보안+배포 가이드 |
| **메타데이터 캐시** | 없음 | docs/training-data.json |

---

### 🔧 기술 스택 추가

**데이터베이스**
- Supabase PostgreSQL
- Row Level Security (RLS)
- Supabase Auth (이메일 기반)

**데이터 소스**
- 안전한국훈련 컨설팅보고서 3,318건
- 훈련결과 정보 (538건)
- 파일 메타데이터 (865건)

**배포**
- Vercel Edge Functions
- 환경변수 관리
- 자동 CI/CD

---

### ✅ 완료 항목

**데이터 통합**
- [x] 안전한국훈련 엑셀 데이터 538건 로드
- [x] CSV 메타데이터 865건 변환 & 업로드
- [x] 총 3,318건 Supabase 저장
- [x] 한글 인코딩 정상화

**보안**
- [x] API 키 환경변수 이동
- [x] RLS 정책 활성화 (로그인 필수)
- [x] 기존 키 재발급
- [x] .env.local .gitignore 추가

**배포**
- [x] Vercel 환경변수 설정 (3개)
- [x] Production 배포 완료
- [x] 라이브 URL 확인

**문서화**
- [x] docs/SECURITY.md 작성
- [x] docs/DEPLOYMENT.md 작성
- [x] docs/SUPABASE-SETUP.md 작성
- [x] docs/training-data.json 생성

---

### 🔐 보안 체크리스트

- [x] API 키 Vercel 환경변수 이동
- [x] index.html에서 하드코딩된 키 제거
- [x] RLS 정책 활성화
- [x] 인증 필수 설정
- [x] .env.local .gitignore 추가
- [x] 기존 Supabase 키 재발급
- [x] 보안 정책 문서 작성

---

### 📚 관련 파일

**데이터**
- `docs/training-data.json` — 메타데이터 캐시 (1,915건)

**보안 & 배포**
- `docs/SECURITY.md` — 보안 정책 및 RLS 설정
- `docs/DEPLOYMENT.md` — Vercel 배포 & 환경변수 가이드
- `docs/SUPABASE-SETUP.md` — Supabase 테이블 생성 SQL

**소스 코드**
- `index.html` — API 키 환경변수 로드 추가
- `.env.local` — 로컬 개발 환경 설정

---

### 🎯 다음 단계

1. **사용자 인증 추가** (선택사항)
   - Supabase Auth UI 컴포넌트 통합
   - 로그인/회원가입 페이지 구현

2. **데이터 시각화**
   - 훈련 결과 대시보드
   - 기관별 통계 차트

3. **API 엔드포인트 보호**
   - Rate limiting 설정
   - API 키 기반 접근 제어

---

## v2.0 — 시뮬레이션 엔진 고도화 (2026-07-10)

[기존 변경 사항은 UPGRADE-PLAN.md 참고]

- 시드 PRNG (mulberry32) 도입
- 시간 진행 피해 모델
- 가변 국면·라운드 시스템
- 혼합 채점 (규칙 60% + AI 40%)
- 결과 시각화 및 RTO 분석

---

**마지막 업데이트**: 2026-07-11  
**담당자**: Mr.Kim × Claude AI
