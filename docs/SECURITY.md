# 🔒 DREX 보안 정책

## 1. API 키 관리

### ⚠️ 중요: API 키 절대 노출 금지
- `index.html`에 API 키를 하드코딩하면 안됨
- GitHub에 커밋되면 누구나 접근 가능
- Supabase 키가 노출되면 즉시 재발급

### ✅ 안전한 관리 방법

**Vercel 환경변수 설정:**
```bash
vercel env add SUPABASE_ANON_KEY
# 새로운 Anon Key 입력

vercel env add SUPABASE_SERVICE_KEY
# Service Role Key 입력 (배포 서버만)
```

**로컬 개발 (.env.local):**
```
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

**index.html에서 사용:**
```js
// ✅ 올바른 방법
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// ❌ 위험한 방법
const SUPABASE_KEY = "eyJ...하드코딩...";
```

---

## 2. Supabase Row Level Security (RLS)

### 현재 정책 (약함)
```sql
CREATE POLICY allow_all ON training_consulting_reports FOR ALL USING (true);
```
👎 누구나 읽고 쓰고 삭제 가능

### 강화된 정책 (추천)
```sql
-- 읽기만 허용 (공개 데이터)
CREATE POLICY read_only_training_reports ON training_consulting_reports
  FOR SELECT USING (true);

-- 쓰기는 인증된 사용자만
CREATE POLICY insert_authenticated_training_reports ON training_consulting_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 삭제는 관리자만
CREATE POLICY admin_delete_training_reports ON training_consulting_reports
  FOR DELETE USING (auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  ));
```

---

## 3. Supabase 설정

### RLS 활성화
```bash
✅ Settings → Authentication → Row Level Security
```

### 정책 설정
```bash
✅ 모든 테이블에서 RLS 활성화
✅ 기본 정책 차단 설정
✅ 필요한 접근만 허용
```

### 사용자 인증
```bash
✅ Settings → Auth → Email/Phone 설정
✅ SMTP 설정 (이메일 인증)
```

---

## 4. API 엔드포인트 보호 (/api/generate)

### 현재 위험 요소
- 누구나 Claude API 호출 가능 → 비용 폭증

### 해결 방법
```js
// api/generate.js (Vercel Edge Function)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1. API 키 검증
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.DREX_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Rate Limiting
  const ip = req.ip;
  if (await checkRateLimit(ip)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  // 3. 비용 한계 설정
  const tokens = await estimateTokens(req.body);
  if (tokens > 10000) {
    return new Response('Request too large', { status: 413 });
  }

  // ... Claude API 호출
}
```

---

## 5. 데이터 암호화

### 민감한 데이터
```sql
-- PII (개인정보) 암호화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ttx_sessions ADD COLUMN org_name_encrypted TEXT;
ALTER TABLE ttx_sessions ADD COLUMN user_email_encrypted TEXT;

-- 암호화된 컬럼에 접근할 때만 복호화
UPDATE ttx_sessions 
SET org_name_encrypted = pgp_sym_encrypt(org_name, 'secret_key')
WHERE org_name IS NOT NULL;
```

---

## 6. 감시 및 로깅

### Supabase 감시
```bash
✅ Settings → Logs → Auth 로그 확인
✅ 비정상 접근 패턴 모니터링
```

### 이상 거래 탐지
```sql
-- 의심스러운 활동 로깅
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event TEXT,
  user_id UUID,
  table_name TEXT,
  operation TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거로 모든 변경 기록
CREATE TRIGGER log_all_changes 
AFTER INSERT OR UPDATE OR DELETE ON ttx_sessions
FOR EACH ROW EXECUTE FUNCTION log_changes();
```

---

## 7. 체크리스트

- [ ] API 키 Vercel 환경변수로 이동
- [ ] Supabase 키 재발급 완료
- [ ] RLS 정책 강화
- [ ] /api/generate 보호 (API 키, Rate Limit)
- [ ] 데이터 암호화 (PII)
- [ ] 감시 및 로깅 설정
- [ ] 정기적 보안 감사
- [ ] 백업 정책 수립

---

## 8. 긴급 대응

### 키 유출 발견 시
1. 즉시 Supabase 콘솔에서 키 재발급
2. GitHub Commit History에서 제거 (BFG Repo-Cleaner 사용)
3. 환경변수 업데이트
4. Vercel 재배포

### 비정상 활동 발견 시
1. 감시 로그 확인
2. 영향받은 데이터 식별
3. 사용자에게 통지
4. 사건 보고

---

## 참고
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/Top10/)
- [Vercel Security](https://vercel.com/docs/concepts/deployments/secure-your-deployments)
