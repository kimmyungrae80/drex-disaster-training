export const config = { runtime: 'edge' };

// 클라이언트 부팅 시 공개 설정을 내려주는 엔드포인트.
// Supabase anon key는 RLS 전제의 공개용 키지만, 레포에 하드코딩하지 않기 위해
// Vercel 환경변수(SUPABASE_URL, SUPABASE_ANON_KEY)에서 런타임에 주입한다.
export default async function handler() {
  return new Response(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    kakaoJsKey: process.env.KAKAO_JS_KEY || '',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
