import {AGENCIES,newSession,start,advance,act,evidence,review,validateChecklist,log} from '../practical/engine.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function text(v,max=2000){if(typeof v!=='string'||v.length>max)throw fail('입력 형식 또는 길이를 확인하세요.');return v;}
export function command(s,member,c){
 if(!c||typeof c.type!=='string')throw fail('조치 형식 오류');
 const owner=member.role==='owner';if(!owner&&!['act','evidence'].includes(c.type))throw fail('훈련 운영자만 가능한 조치입니다.',403);
 if(c.type==='act')act(s,c.task,c.kind,owner?c.agency:member.agency,text(c.text||''),Boolean(c.assisted));
 else if(c.type==='evidence')evidence(s,owner?c.agency:member.agency,text(c.text,4000));
 else if(c.type==='advance')advance(s,c.minutes||1);
 else if(c.type==='end'){if(s.status!=='running')throw fail('진행 중인 훈련만 종료할 수 있습니다.');s.status='ended';log(s,'end',{text:'운영자 훈련 종료'});}
 else if(c.type==='review')review(s,c.id,c.verdict,text(c.reason),Array.isArray(c.ids)?c.ids:[]);
 else if(c.type==='improve'){if(!s.checklist.some(r=>r.id===c.id))throw fail('점검 항목 없음');s.improvements[c.id]={action:text(c.action||''),owner:text(c.owner||'',200),due:text(c.due||'',30)};log(s,'improve',{text:c.id+' 개선과제 저장'});}
 else if(c.type==='notes'){s.notes=text(c.text,8000);log(s,'notes',{text:'종합 의견 갱신'});}
 else if(c.type==='map'){if(!c.snapshot||JSON.stringify(c.snapshot).length>250000)throw fail('지도 크기 초과');s.map=c.snapshot;s.revision++;}
 else throw fail('지원하지 않는 조치');
 if(s.events.length>3000)throw fail('기록 한도입니다. 보고서를 저장하고 새 훈련을 시작하세요.');
}
export function makeHandler(store){return async req=>{
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  if(req.method!=='POST')return send({error:'POST 요청만 지원합니다.'},405);
  const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)throw fail('다른 출처의 요청은 허용하지 않습니다.',403);
  const raw=await req.text();if(raw.length>300000)throw fail('요청 크기 초과',413);const b=JSON.parse(raw);
  if(b.op==='create'){
   const s=newSession();s.title=text(b.title||s.title,150);s.org=text(b.org||'훈련기관',100);s.checklist=validateChecklist(b.checklist);s.checklistSource=text(b.source||'사용자 점검표',200);start(s);
   const credential=token(),invite=token(),ownerHash=await hash(credential);
   const row={id:s.id,revision:0,payload:{session:s,members:{[ownerHash]:{role:'owner',agency:'지자체',name:'훈련운영자'}},inviteHash:await hash(invite),requests:[]},expires_at:new Date(Date.now()+86400000).toISOString()};await store.insert(row);
   return send({session:s,revision:0,token:credential,invite,member:row.payload.members[ownerHash]});
  }
  if(typeof b.id!=='string'||!/^[0-9a-f-]{36}$/.test(b.id))throw fail('세션 번호를 확인하세요.');
  const row=await store.get(b.id);if(!row||Date.parse(row.expires_at)<Date.now())throw fail('훈련이 없거나 참여 유효기간(24시간)이 지났습니다.',404);
  const p=row.payload;
  if(b.op==='join'){
   if(!b.invite||await hash(text(b.invite,128))!==p.inviteHash)throw fail('초대 코드가 올바르지 않습니다.',403);
   if(p.session.status!=='running')throw fail('종료된 훈련에는 새로 참여할 수 없습니다.');if(!AGENCIES.includes(b.agency))throw fail('기관을 선택하세요.');
   if(Object.values(p.members).some(m=>m.role==='agency'&&m.agency===b.agency))throw fail('이미 참여 중인 기관입니다. 기존 접속 브라우저를 사용하세요.',409);
   const credential=token(),h=await hash(credential);p.members[h]={role:'agency',agency:b.agency,name:text(b.name||b.agency,100)};
   log(p.session,'join',{agency:b.agency,text:p.members[h].name+' 참여'});
   if(!await store.update(row.id,row.revision,p))throw fail('다른 참여 요청과 겹쳤습니다. 다시 참여하세요.',409);
   return send({session:p.session,revision:row.revision+1,token:credential,member:p.members[h]});
  }
  const credential=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const member=p.members[await hash(credential)];if(!member)throw fail('접속 인증이 필요합니다.',401);
  const result=()=>({session:p.session,revision:row.revision,member,participants:Object.values(p.members)});
  if(b.op==='read')return send(result());
  if(b.op!=='command')throw fail('지원하지 않는 요청');
  if(typeof b.requestId!=='string'||b.requestId.length>100)throw fail('요청 번호가 필요합니다.');
  if(p.requests.includes(b.requestId))return send(result());
  if(b.revision!==row.revision)return send({...result(),error:'다른 기관의 조치가 먼저 반영되었습니다. 최신 내용을 확인하고 다시 조치하세요.'},409);
  command(p.session,member,b.command);p.requests=[...p.requests,b.requestId].slice(-200);
  if(!await store.update(row.id,row.revision,p))throw fail('동시 조치가 발생했습니다. 최신 내용을 불러온 후 다시 조치하세요.',409);
  return send({...result(),revision:row.revision+1});
 }catch(e){return send({error:e.status?e.message:e instanceof SyntaxError?'요청 데이터를 읽을 수 없습니다.':e.message||'요청 실패'},e.status||400);}
};}
