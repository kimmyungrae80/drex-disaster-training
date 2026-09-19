import {makeHandler} from '../server/practical-service.mjs';
export const config={runtime:'edge'};
export default async function handler(req){
 // This is the same established project used by the existing DREX client.
 const defaultUrl='https://jouasqnsbxbikvjrrfnd.supabase.co';
 const clean=(value,name)=>String(value||'').trim().replace(new RegExp('^'+name+'\\s*=\\s*'),'').replace(/^(['"])([\s\S]*)\1$/,'$2').trim();
 const supplied=clean(process.env.SUPABASE_URL,'SUPABASE_URL').replace(/\/+$/,'');
 let url=defaultUrl;
 try{const u=new URL(supplied);if(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password)url=u.origin;}catch{}
 const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY,'SUPABASE_SERVICE_ROLE_KEY');
 const unavailable=message=>new Response(JSON.stringify({error:message}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!key)return unavailable('공동훈련 서버 설정이 필요합니다. SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY와 practical_sessions 테이블을 확인하세요.');
 async function rest(path,options={}){
  const res=await fetch(url+'/rest/v1/practical_sessions'+path,{...options,headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});
  const fail=message=>Object.assign(new Error(message),{status:503});
  if(!res.ok){if(res.status===401||res.status===403)throw fail('Supabase 서버 키 인증 실패. 같은 프로젝트의 service_role 또는 서버용 secret 키인지 확인하세요.');if(res.status===404)throw fail('공동훈련 테이블을 찾지 못했습니다. 같은 Supabase 프로젝트에 practical_sessions 생성 SQL을 실행했는지 확인하세요.');throw fail('공동훈련 저장소 연결 실패 (상태 '+res.status+'). 서버 설정과 테이블을 확인하세요.');}
  if(res.status===204)return [];
  if(!(res.headers.get('content-type')||'').includes('json'))throw fail('Supabase가 JSON 대신 다른 형식으로 응답했습니다. SUPABASE_URL이 대시보드 주소가 아닌 프로젝트 API 주소인지 확인하세요.');
  let data;try{data=await res.json();}catch{throw fail('Supabase 응답을 읽을 수 없습니다. 프로젝트 API 주소와 서비스 상태를 확인하세요.');}
  if(!Array.isArray(data))throw fail('공동훈련 저장소 응답 형식 오류. 프로젝트 API 주소를 확인하세요.');return data;
 }
 const store={insert:row=>rest('',{method:'POST',body:JSON.stringify(row)}),get:async id=>(await rest('?id=eq.'+encodeURIComponent(id)+'&select=*'))[0],update:async(id,revision,payload)=>{const rows=await rest('?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'PATCH',body:JSON.stringify({payload,revision:revision+1})});return rows.length===1;}};
 return makeHandler(store)(req);
}
