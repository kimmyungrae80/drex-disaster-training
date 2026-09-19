import {makeHandler} from '../server/practical-service.mjs';
export const config={runtime:'edge'};
export default async function handler(req){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return new Response(JSON.stringify({error:'공동훈련 서버 설정이 필요합니다. SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY와 practical_sessions 테이블을 확인하세요.'}),{status:503,headers:{'Content-Type':'application/json'}});
 async function rest(path,options={}){const res=await fetch(url+'/rest/v1/practical_sessions'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});if(!res.ok)throw Object.assign(new Error('공동훈련 저장소 연결 실패. 서버 설정과 테이블을 확인하세요.'),{status:503});return res.status===204?[]:res.json();}
 const store={insert:row=>rest('',{method:'POST',body:JSON.stringify(row)}),get:async id=>(await rest('?id=eq.'+encodeURIComponent(id)+'&select=*'))[0],update:async(id,revision,payload)=>{const rows=await rest('?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'PATCH',body:JSON.stringify({payload,revision:revision+1})});return rows.length===1;}};
 return makeHandler(store)(req);
}
