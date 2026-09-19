import test from 'node:test';import assert from 'node:assert/strict';import handler from '../api/practical.js';
const request=()=>new Request('https://drex-disaster-training.vercel.app/api/practical',{method:'POST',body:JSON.stringify({op:'read',id:'00000000-0000-0000-0000-000000000000'})});
test('설정 복사 형식 정리와 기존 프로젝트 기본주소를 사용한다',async()=>{const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldFetch=globalThis.fetch;try{
 process.env.SUPABASE_SERVICE_ROLE_KEY='SUPABASE_SERVICE_ROLE_KEY="sb_secret_example"';
 let called,headers;globalThis.fetch=async(url,opts)=>{called=url;headers=opts.headers;return new Response('[]',{headers:{'Content-Type':'application/json'}});};
 for(const url of ['', '잘못 복사된 주소', 'https://supabase.com/dashboard/project/jouasqnsbxbikvjrrfnd', 'SUPABASE_URL="https://jouasqnsbxbikvjrrfnd.supabase.co/"']){process.env.SUPABASE_URL=url;const r=await handler(request());assert.equal(r.status,404);assert.ok(called.startsWith('https://jouasqnsbxbikvjrrfnd.supabase.co/rest/v1/'));assert.equal(headers.apikey,'sb_secret_example');assert.equal(headers.Authorization,undefined);}
 process.env.SUPABASE_SERVICE_ROLE_KEY='';assert.equal((await handler(request())).status,503);
 }finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}});
