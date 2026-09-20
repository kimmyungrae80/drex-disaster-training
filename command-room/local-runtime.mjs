import {ROOM_VERSION,ORGS,JOBS,buildScenario,makeRoom,knownReports,applyRoomCommand,tickRoom,roomAAR,roomError,cleanText} from './model.mjs';
const secret=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function digest(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function publicView(row,member){
 const p=row.payload,s=p.room,control=member.kind==='control';const humans=Object.values(p.members).filter(m=>m.kind==='participant').map(m=>m.org);
 const reports=control?s.reports:knownReports(s,member.org),requests=control?s.requests:s.requests.filter(r=>r.from===member.org||r.to===member.org);
 return {id:row.id,revision:row.revision,member,version:ROOM_VERSION,status:s.status,time:s.time,mode:s.mode,scenario:s.scenario,serverTime:Date.now(),participants:Object.entries(ORGS).map(([org,name])=>({org,name,mode:humans.includes(org)?'human':p.auto?'auto':'unassigned',members:Object.values(p.members).filter(m=>m.org===org).map(m=>m.name)})),reports,requests,resources:control?s.resources:{[member.org]:s.resources[member.org]},events:s.events.filter(e=>control||e.type==='share'||e.org===member.org||e.to===member.org||['created','started','paused','resumed','ended'].includes(e.type)),world:control?s.world:null,invites:control?p.invites:undefined,solo:p.solo,auto:p.auto,aar:s.status==='ended'?roomAAR(s,control?null:member.org):null};
}
export function makeRoomHandler(store,{now=()=>Date.now(),generate=null}={}){return async req=>{
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{
  if(req.method!=='POST')throw roomError('POST 요청만 지원합니다.',405);
  const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)throw roomError('다른 출처의 요청은 허용하지 않습니다.',403);
  const raw=await req.text();if(raw.length>50000)throw roomError('요청 크기가 너무 큽니다.',413);const b=JSON.parse(raw);
  if(b.op==='health'){await store.health();return send({ready:true,ai:!!generate});}
  if(b.op==='scenario'){
   let scenario=buildScenario(b.config);let notice='입력 조건에 따라 교육용 규칙과 시나리오를 자동 구성했습니다.';
   if(generate){try{const ai=await generate(scenario);scenario={...scenario,title:cleanText(ai.title,200),brief:cleanText(ai.brief,2000),source:'ai'};notice='AI가 훈련 조건을 바탕으로 상황 설명을 생성했습니다. 인원·시간·자원은 모의규칙으로 고정됩니다.';}catch{notice='AI 연결이 원활하지 않아 규칙 기반 시나리오를 구성했습니다. 생성 방식을 확인하고 시작하세요.';}}
   return send({scenario,notice});
  }
  if(b.op==='create'){
   const scenario=buildScenario(b.scenario,b.scenario?.seed);if(b.scenario?.brief){scenario.brief=cleanText(b.scenario.brief,2000);scenario.title=cleanText(b.scenario.title,200);scenario.source='reviewed';}
   const solo=b.solo===true;if(solo&&!ORGS[b.org])throw roomError('본인 기관을 선택하세요.');
   const credential=secret(),h=await digest(credential),owner={kind:solo?'participant':'control',org:solo?b.org:null,name:cleanText(b.name||'훈련 담당자',80)};
   const room=makeRoom(scenario,b.mode,now()),id=crypto.randomUUID(),invites=Object.fromEntries(Object.keys(ORGS).map(o=>[o,secret()]));
   if(solo){room.status='running';room.lastTick=now();}
   const row={id,revision:0,expires_at:new Date(now()+86400000).toISOString(),payload:{kind:ROOM_VERSION,room,members:{[h]:owner},invites,auto:solo||b.auto===true,solo,receipts:[]}};await store.insert(row);return send({...publicView(row,owner),token:credential});
  }
  if(typeof b.id!=='string'||!/^[0-9a-f-]{36}$/.test(b.id))throw roomError('훈련방 주소를 확인하세요.');
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const h=await digest(token);
  for(let attempt=0;attempt<5;attempt++){
   const saved=await store.get(b.id);if(!saved||Date.parse(saved.expires_at)<now())throw roomError('훈련방이 없거나 유효기간(24시간)이 지났습니다.',404);
   const row=structuredClone(saved),p=row.payload;if(p.kind!==ROOM_VERSION)throw roomError('다른 버전의 훈련방입니다.',404);const s=p.room;
   if(b.op==='join'){
    if(p.solo)throw roomError('개인 연습방에는 다른 참가자가 입장할 수 없습니다.',403);
    if(!ORGS[b.org]||!b.invite||b.invite!==p.invites[b.org])throw roomError('기관별 초대 링크가 올바르지 않습니다.',403);
    if(s.status==='ended')throw roomError('종료된 훈련방입니다.');
    if(Object.values(p.members).some(m=>m.org===b.org))throw roomError('이미 입장한 기관입니다. 입장했던 브라우저 또는 저장한 접속코드를 사용하세요.',409);
    const credential=secret(),m={kind:'participant',org:b.org,name:cleanText(b.name,80)};p.members[await digest(credential)]=m;
    if(!await store.update(row.id,row.revision,p))continue;row.revision++;return send({...publicView(row,m),token:credential});
   }
   const member=p.members[h];if(!member)throw roomError('접속 인증이 필요합니다. 저장한 접속코드로 다시 입장하세요.',401);
   if(!['read','command'].includes(b.op))throw roomError('지원하지 않는 요청입니다.');
   const humanOrgs=Object.values(p.members).filter(m=>m.kind==='participant').map(m=>m.org);
   const bots=p.auto?Object.keys(ORGS).filter(o=>!humanOrgs.includes(o)):[];
   let changed=tickRoom(s,bots,now());
   if(b.op==='command'){
    if(typeof b.requestId!=='string'||!/^[a-zA-Z0-9-]{10,100}$/.test(b.requestId))throw roomError('요청 식별자가 필요합니다.');
    const receipt=h+':'+b.requestId;
    if(!p.receipts.includes(receipt)){
     const c=b.command;if(!c||typeof c.type!=='string')throw roomError('조치 내용이 없습니다.');
     if(member.kind==='control'){
      if(c.type==='start'){if(s.status!=='lobby')throw roomError('대기 중인 훈련만 시작할 수 있습니다.');if(!humanOrgs.length)throw roomError('기관 참가자 입장 후 시작하세요.');if(!p.auto&&humanOrgs.length<13)throw roomError('13개 기관이 모두 입장하거나 미참여 기관 자동 대응을 켜세요.');s.status='running';s.lastTick=now();s.events.push({id:'E'+(s.events.length+1),time:s.time,type:'started',org:'control',text:'훈련 시작'});}
      else if(c.type==='pause'||c.type==='resume'){if(s.status!==(c.type==='pause'?'running':'paused'))throw roomError('현재 상태에서 실행할 수 없습니다.');s.status=c.type==='pause'?'paused':'running';s.lastTick=now();s.events.push({id:'E'+(s.events.length+1),time:s.time,type:c.type==='pause'?'paused':'resumed',org:'control',text:c.type==='pause'?'훈련 일시정지':'훈련 재개'});}
      else if(c.type==='advance'){if(!Number.isInteger(c.minutes)||c.minutes<1||c.minutes>10)throw roomError('1~10분만 진행하세요.');if(s.status!=='running')throw roomError('진행 중인 훈련만 시간을 진행할 수 있습니다.');tickRoom(s,bots,now(),c.minutes);}
      else if(c.type==='end'){if(!['running','paused'].includes(s.status))throw roomError('진행 중인 훈련만 종료할 수 있습니다.');s.status='ended';s.events.push({id:'E'+(s.events.length+1),time:s.time,type:'ended',org:'control',text:'통제자 종료'});}
      else if(c.type==='auto'){if(s.status!=='lobby')throw roomError('시작 전에 설정하세요.');p.auto=c.enabled===true;}
      else if(c.type==='inject'){if(s.status!=='running'||!ORGS[c.org])throw roomError('진행 상태와 수신 기관을 확인하세요.');s.reports.push({id:'R'+(s.reports.length+1),org:c.org,text:cleanText(c.text,2000),site:'center',source:'controller',time:s.time,shared:false});}
      else throw roomError('통제자는 기관 조치를 대신 수행하지 않습니다.',403);
     }else if(c.type==='endSolo'&&p.solo){s.status='ended';}
     else{if(s.events.length>3500)throw roomError('기록 한도에 도달했습니다. 훈련을 종료하세요.');applyRoomCommand(s,member.org,c);}
     p.receipts.push(receipt);if(p.receipts.length>5000)throw roomError('훈련 기록 한도입니다.');changed=true;
    }
   }
   if(changed){if(!await store.update(row.id,row.revision,p))continue;row.revision++;}
   return send(publicView(row,member));
  }
  throw roomError('동시 요청이 많습니다. 같은 요청을 잠시 후 다시 보내세요.',409);
 }catch(e){return send({error:e.status?e.message:e instanceof SyntaxError?'요청 형식을 확인하세요.':'서버 처리 중 오류가 발생했습니다.',retryable:e.status===409},e.status||500);}
};}

export function makeLocalRequest(){
 const key='drex-room-local-v1';let rows={};try{rows=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 const persist=()=>localStorage.setItem(key,JSON.stringify(rows));
 const store={health:async()=>true,insert:async r=>{rows[r.id]=structuredClone(r);persist();},get:async id=>rows[id]?structuredClone(rows[id]):null,update:async(id,revision,payload)=>{if(!rows[id]||rows[id].revision!==revision)return false;rows[id]={...rows[id],revision:revision+1,payload:structuredClone(payload)};persist();return true;}};
 return makeRoomHandler(store);
}
