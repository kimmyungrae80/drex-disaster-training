# 🚀 DREX Vercel 배포 가이드

## 1. 환경변수 설정 (필수)

### Vercel 프로젝트 환경변수 설정
```bash
# 1. Vercel CLI 설정
npm install -g vercel
vercel login

# 2. 프로젝트 연결
cd ~/Desktop/drex-disaster-training
vercel

# 3. 환경변수 추가
vercel env add SUPABASE_ANON_KEY
# 프롬프트에 새로운 Anon Key 입력 (Supabase 콘솔에서 복사)

vercel env add SUPABASE_SERVICE_KEY
# 프롬프트에 Service Role Key 입력 (백엔드/API용)

vercel env add DREX_API_KEY
# 프롬프트에 임의의 강력한 키 입력 (API 엔드포인트 보호용)
```

### 확인
```bash
vercel env ls
# 모든 환경변수 목록 확인
```

---

## 2. 로컬 개발 환경

### .env.local 생성
```bash
cd ~/Desktop/drex-disaster-training
cat > .env.local << 'EOF'
SUPABASE_ANON_KEY=eyJ... (새로운 Anon Key)
SUPABASE_SERVICE_KEY=eyJ... (Service Role Key)
DREX_API_KEY=your-secret-key-here
EOF

# .gitignore에 .env.local 추가 확인
echo ".env.local" >> .gitignore
```

### 로컬 서버 실행
```bash
npx serve -p 3333 .
```

---

## 3. 배포

### Preview (테스트 배포)
```bash
vercel --prod=false
# 테스트 URL 생성
```

### Production (실제 배포)
```bash
vercel --prod
# 프로덕션 배포
```

### 확인
```bash
vercel ls
# 배포된 버전 확인
```

---

## 4. 배포 후 확인

### 1️⃣ 헬스 체크
```bash
curl https://drex-disaster-training.vercel.app
# HTML 응답 확인
```

### 2️⃣ Supabase 연결 테스트
```js
// 브라우저 콘솔에서
await supabaseClient.from('ttx_sessions').select().limit(1)
// 정상 응답 확인
```

### 3️⃣ API 엔드포인트 테스트
```bash
curl -X POST https://drex-disaster-training.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{"prompt":"test"}'
```

---

## 5. 트러블슈팅

### API 키 오류
```
Error: Could not find the table in the schema cache
```
→ 환경변수 설정 확인, Vercel 재배포

### Supabase 연결 안됨
```
Error: No Supabase client
```
→ SUPABASE_ANON_KEY 환경변수 확인

### CORS 에러
```
Access to XMLHttpRequest blocked by CORS policy
```
→ Supabase Settings → CORS 설정 확인

---

## 6. CI/CD 자동 배포

### GitHub Actions 설정
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true
```

### 환경변수 동기화
```bash
# Vercel → GitHub Secrets에 복사 (권장하지 않음)
# 대신 Vercel에서 환경변수 직접 관리
```

---

## 7. 모니터링

### Vercel Analytics
```bash
✅ Settings → Analytics 활성화
```

### 로그 확인
```bash
vercel logs
# 실시간 로그 스트림
```

### 성능 최적화
```bash
vercel analytics --json
# Core Web Vitals 확인
```

---

## 8. 보안 체크리스트

- [ ] .env.local .gitignore에 추가
- [ ] API 키 environment 변수로 설정
- [ ] vercel.json에 민감 정보 없음
- [ ] index.html에 키 하드코딩 없음
- [ ] SUPABASE_KEY 변수만 사용 (하드코딩된 값 아님)
- [ ] rate limiting 설정
- [ ] RLS 정책 활성화
- [ ] 감시 로깅 설정

---

## 참고 명령어

```bash
# 배포 상태 확인
vercel status

# 특정 환경변수 확인
vercel env get SUPABASE_ANON_KEY

# 환경변수 제거
vercel env rm SUPABASE_ANON_KEY

# 배포 롤백
vercel rollback

# 함수 로그 확인
vercel logs --follow
```
