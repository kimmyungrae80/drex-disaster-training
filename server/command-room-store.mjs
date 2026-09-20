export function makeRoomStore(env,fetcher=fetch){
 const clean=(v,n)=>String(v||'').trim().replace(new RegExp('^'+n+'\\s*=\\s*'),'').replace(/^(['"])([\s\S]*)\1$/,'$2').trim();
 const supplied=clean(env.SUPABASE_URL,'SUPABASE_URL');let url='https://jouasqnsbxbikvjrrfnd.supabase.co';try{const u=new URL(supplied);if(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash)url=u.origin;}catch{}
 const key=clean(env.SUPABASE_SERVICE_ROLE_KEY,'SUPABASE_SERVICE_ROLE_KEY');
 const unavailable=m=>Object.assign(new Error(m),{status:503});
 async function rest(path,options={}){
  if(!key)throw unavailable('공동훈련 서버 키가 설정되지 않았습니다. 운영자가 Supabase 서버 연결을 설정해야 합니다.');
  const res=await fetcher(url+'/rest/v1/practical_sessions'+path,{...options,signal:AbortSignal.timeout(12000),headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Prefer:'return=representation'}});
  if(!res.ok){if([401,403].includes(res.status))throw unavailable('공동훈련 저장소 인증 실패. 운영자가 같은 Supabase 프로젝트의 서버 키를 확인해야 합니다.');throw unavailable('공동훈련 저장소 연결 실패. 테이블과 서버 설정을 확인하세요.');}
  const data=await res.json();if(!Array.isArray(data))throw unavailable('저장소 응답 형식이 올바르지 않습니다.');return data;
 }
 return {health:()=>rest('?select=id&limit=1'),insert:row=>rest('',{method:'POST',body:JSON.stringify(row)}),get:async id=>(await rest('?id=eq.'+encodeURIComponent(id)+'&select=*'))[0],update:async(id,revision,payload)=>(await rest('?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'PATCH',body:JSON.stringify({revision:revision+1,payload})})).length===1};
}
