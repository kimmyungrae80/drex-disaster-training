import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExerciseHandler} from '../server/exercise-service.mjs';
import {configOf,makeExercise,participantCommand,advance,projected} from '../exercise/engine.mjs';
function harness({generate=null}={}){
  let clock=1700000000000;const rows=new Map();let collisions=0;
  const store={health:async()=>true,insert:async r=>{if(rows.has(r.id))throw Error('duplicate');rows.set(r.id,structuredClone(r));},get:async id=>structuredClone(rows.get(id)),update:async(id,revision,payload)=>{if(collisions){collisions--;return false;}const r=rows.get(id);if(r.revision!==revision)return false;rows.set(id,{...r,revision:revision+1,payload:structuredClone(payload)});return true;}};
  const handle=makeExerciseHandler(store,{now:()=>clock,generate});
  return {rows,store,handle,step:n=>clock+=n*60000,collision:n=>collisions=n,call:async(b,token,headers={})=>{const res=await handle(new Request('https://drex.test/api/exercise',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(b)}));return {http:res.status,...await res.json()};}};
}
const create=(h,config={})=>h.call({op:'create',name:'운영자',config});
const join=(h,r,org,name=org)=>h.call({op:'join',id:r.id,org,invite:r.invites[org],name});
const cmd=(h,r,command,requestId=crypto.randomUUID())=>h.call({op:'command',id:r.id,requestId,command},r.token);
const read=(h,r)=>h.call({op:'read',id:r.id},r.token);
async function setup(config={}){const h=harness(),host=await create(h,config),people={};for(const o of host.config.orgs)people[o.id]=await join(h,host,o.id);assert.equal((await cmd(h,host,{type:'start'})).http,200);return {h,host,people};}
async function request(h,from,to,action){const r=await cmd(h,from,{type:'request',to,action,reason:'수요와 현장 조건을 확인해 지원 요청'});assert.equal(r.http,200);return r.requests.at(-1);}
async function run(h,host,from,to,action){const q=await request(h,from,to.member.org,action);assert.equal((await cmd(h,to,{type:'accept',id:q.id,reason:'담당 임무 확인 후 수락'})).http,200);assert.equal((await cmd(h,to,{type:'startAction',id:q.id})).http,200);h.step(5);const result=(await read(h,from)).requests.find(x=>x.id===q.id);return result;}

test('서버에서 기관 정보·세계·초대·미래 상황을 분리한다',async()=>{
  const {h,host,people}=await setup();const fire=await read(h,people.fire),police=await read(h,people.police);
  assert.equal(fire.world,null);assert.equal(fire.invites,undefined);assert.equal(fire.config.variant,undefined);assert.ok(fire.reports.every(r=>r.org==='fire'));assert.doesNotMatch(JSON.stringify(fire),/actualCount|최초 신고 8명과|사전 등록 인원은 12명/);
  const secretReport=host.reports.find(r=>r.org==='hq');assert.equal((await cmd(h,people.fire,{type:'decision',reason:'읽지 못한 정보를 근거로 시도',evidence:[secretReport.id]})).http,403);
  assert.equal((await cmd(h,people.fire,{type:'share',id:secretReport.id})).http,403);
  await cmd(h,people.fire,{type:'share',id:fire.reports[0].id});assert.ok((await read(h,people.police)).reports.some(r=>r.org==='fire'));assert.ok(!police.reports.some(r=>r.org==='fire'));
});
test('초대는 기관에 고정되며 한 기관의 여러 참가자가 함께 입장한다',async()=>{
  const h=harness(),host=await create(h);assert.equal((await h.call({op:'join',id:host.id,org:'police',invite:host.invites.fire,name:'변조'})).http,403);
  const a=await join(h,host,'fire','소방 A'),b=await join(h,host,'fire','소방 B');assert.equal(a.http,200);assert.equal(b.http,200);assert.equal(b.participants.find(p=>p.id==='fire').members.length,2);
  assert.equal((await h.call({op:'read',id:host.id},'bad')).http,401);assert.equal((await cmd(h,a,{type:'inject',org:'police',text:'권한 우회'})).http,403);
});
test('필수 참가기관과 운영자·기관의 역할을 분리한다',async()=>{
  const h=harness(),host=await create(h),fire=await join(h,host,'fire');assert.equal((await cmd(h,host,{type:'start'})).http,400);
  assert.equal((await cmd(h,fire,{type:'start'})).http,403);assert.equal((await cmd(h,host,{type:'request',to:'police',action:'traffic',reason:'대리 조치'})).http,403);
});
test('실제 참가자의 요청·수락·착수·모의 결과·결과 확인이 이어진다',async()=>{
  const {h,host,people}=await setup();const q=await run(h,host,people.fire,people.police,'traffic');assert.equal(q.status,'result_reported');
  assert.equal((await cmd(h,people.police,{type:'confirm',id:q.id,reason:'수신기관이 확인 시도'})).http,403);
  const r=await cmd(h,people.fire,{type:'confirm',id:q.id,reason:'통제 완료 회신 확인, 진입계획에 반영'});assert.equal(r.requests.find(x=>x.id===q.id).status,'confirmed');
  await cmd(h,host,{type:'end'});const report=await read(h,host);assert.equal(report.aar.metrics.humanClosedLoops,1);
});
test('가용 자원 초과·중복 착수·다른 기관의 수락을 거부한다',async()=>{
  const {h,people}=await setup();const q1=await request(h,people.hq,'fire','verify'),q2=await request(h,people.police,'fire','rescue');
  assert.equal((await cmd(h,people.hq,{type:'accept',id:q1.id,reason:'잘못된 기관'})).http,403);
  for(const q of [q1,q2])await cmd(h,people.fire,{type:'accept',id:q.id,reason:'요청 접수'});
  assert.equal((await cmd(h,people.fire,{type:'startAction',id:q1.id})).http,200);assert.equal((await cmd(h,people.fire,{type:'startAction',id:q2.id})).http,400);assert.equal((await cmd(h,people.fire,{type:'startAction',id:q1.id})).http,400);
});
test('현장 조치는 사전조건을 기다리고 조건 충족 후에만 진행된다',async()=>{
  const {h,host,people}=await setup();const q=await request(h,people.hq,'fire','rescue');await cmd(h,people.fire,{type:'accept',id:q.id,reason:'지원 수락'});await cmd(h,people.fire,{type:'startAction',id:q.id});h.step(6);
  let r=await read(h,people.fire);assert.equal(r.requests.find(x=>x.id===q.id).blocked,true);assert.equal((await read(h,host)).world.rescueComplete,false);
  await run(h,host,people.hq,people.police,'traffic');await run(h,host,people.hq,people.works,'isolate');await run(h,host,people.hq,people.welfare,'shelter');h.step(5);r=await read(h,host);assert.equal(r.world.rescueComplete,true);assert.equal(r.requests.find(x=>x.id===q.id).status,'result_reported');
});
test('판단 근거는 당시 정보 스냅샷을 보존한다',async()=>{
  const {h,people}=await setup();const first=people.fire.reports[0];await cmd(h,people.fire,{type:'decision',reason:'최초 신고를 잠정 정보로 판단',evidence:[first.id],objectives:['information']});
  await cmd(h,people.fire,{type:'verifyReport',id:first.id,source:'추가 전화 확인',reason:'신고내용 재확인'});const r=await read(h,people.fire);assert.equal(r.reports[0].reliability,'confirmed');assert.equal(r.decisions[0].evidence[0].reliability,'unconfirmed');
});
test('자유 대응은 운영자가 근거를 남겨 판정하며 메시지 자체는 세계를 바꾸지 않는다',async()=>{
  const {h,host,people}=await setup();await cmd(h,host,{type:'inject',org:'fire',text:'모든 현장 지원이 끝났다는 제보',source:'제보자'});assert.equal((await read(h,host)).world.rescueComplete,false);
  const p=await cmd(h,people.fire,{type:'proposal',text:'대체 접근로 활용 제안',reason:'현장 회신에 따라 우회로 확보',evidence:[]});assert.equal((await cmd(h,people.fire,{type:'adjudicate',id:p.adjudications[0].id,verdict:'approved',effect:'roadOpen',reason:'자가 판정'})).http,403);
  const reviewed=await cmd(h,host,{type:'adjudicate',id:p.adjudications[0].id,verdict:'approved',effect:'roadOpen',reason:'훈련 가정상 우회로 활용 가능 확인'});assert.equal(reviewed.world.roadOpen,true);assert.equal((await read(h,people.police)).adjudications.length,0);
});
test('동시 요청과 동일 요청 재전송을 원자적으로 처리한다',async()=>{
  const {h,host,people}=await setup();await Promise.all([request(h,people.hq,'fire','verify'),request(h,people.police,'works','isolate')]);const id=crypto.randomUUID(),c={type:'request',to:'welfare',action:'shelter',reason:'대피 준비'};
  await Promise.all([cmd(h,people.hq,c,id),cmd(h,people.hq,c,id)]);assert.equal((await read(h,host)).requests.length,3);h.collision(3);assert.equal((await cmd(h,people.hq,{type:'decision',reason:'상황 검토'})).http,200);
});
test('일시정지 중 시간을 동결하고 종료 후 기관 조치를 막는다',async()=>{
  const {h,host,people}=await setup();h.step(3);await cmd(h,host,{type:'pause'});h.step(10);assert.equal((await read(h,people.hq)).time,3);await cmd(h,host,{type:'resume'});h.step(2);assert.equal((await read(h,people.hq)).time,5);await cmd(h,host,{type:'end'});assert.equal((await cmd(h,people.hq,{type:'decision',reason:'종료 후 수정'})).http,400);
});
test('개인 연습 모의기관 실적은 실제 협업 실적에서 제외한다',async()=>{
  const h=harness(),solo=await create(h,{scope:'solo',ownOrg:'fire'});assert.equal(solo.member.kind,'participant');assert.equal(solo.world,null);const q=await request(h,solo,'police','traffic');h.step(5);const r=await read(h,solo);assert.equal(r.requests[0].status,'result_reported');await cmd(h,solo,{type:'confirm',id:q.id,reason:'모의 회신 확인'});const ended=await cmd(h,solo,{type:'end'});assert.equal(ended.aar.metrics.humanClosedLoops,0);assert.equal(ended.aar.metrics.simulatedLoops,1);assert.ok(ended.aar.decisions.every(d=>d.org==='fire'));
});
test('기관 수를 고정하지 않고 사용자 기관명·임무 배정을 사용한다',async()=>{
  const h=harness();const orgs=[{id:'safety',name:'사업장 안전팀',capabilities:['verify','rescue','warning']},{id:'facility',name:'사업장 시설팀',capabilities:['traffic','isolate','shelter']}];const host=await create(h,{orgs,ownOrg:'safety'});assert.equal(host.http,200);assert.equal(host.participants.length,2);await join(h,host,'safety');await join(h,host,'facility');assert.equal((await cmd(h,host,{type:'start'})).http,200);
});
test('기관 내부훈련의 초대는 대상 기관으로 제한된다',async()=>{
  const h=harness(),host=await create(h,{scope:'agency',ownOrg:'works'});assert.equal((await join(h,host,'fire')).http,403);assert.equal((await join(h,host,'works')).http,200);assert.equal((await cmd(h,host,{type:'start'})).http,200);
});
test('강평 미확인을 실패로 판정하지 않으며 운영자 판정에는 근거가 필요하다',async()=>{
  const {h,host,people}=await setup();await cmd(h,host,{type:'end'});let r=await read(h,host);assert.ok(r.aar.criteria.every(c=>c.status==='unknown'));
  assert.equal((await cmd(h,host,{type:'review',objective:'information',verdict:'met',reason:'근거 없는 판정',evidence:[]})).http,400);
  r=await cmd(h,host,{type:'review',objective:'information',verdict:'unknown',reason:'판단할 관찰 기록이 없음',evidence:[r.events[0].id]});assert.equal(r.aar.criteria[0].review.verdict,'unknown');assert.equal((await read(h,people.fire)).aar.criteria[0].review,null);
});
test('개선과제를 재훈련에 전달하고 중복 재훈련 개설을 방지한다',async()=>{
  const {h,host}=await setup();await cmd(h,host,{type:'end'});await cmd(h,host,{type:'improvement',objective:'coordination',owner:'fire',text:'지원 결과 확인 절차 보완',due:'2026-11-30',retest:'회신을 받고 확인 기록 남기기'});
  const [a,b]=await Promise.all([h.call({op:'retrain',id:host.id},host.token),h.call({op:'retrain',id:host.id},host.token)]);assert.equal(a.http,200);assert.equal(b.http,200);assert.equal(a.id,b.id);assert.equal(h.rows.size,2);assert.equal(a.improvements[0].status,'retest');assert.equal(a.status,'lobby');
  for(const o of a.config.orgs)await join(h,a,o.id);await cmd(h,a,{type:'start'});h.step(8);const r=await read(h,a);assert.ok(r.events.some(e=>e.message.includes('진입로 조건 변화')));
});
test('개선과제 재검증은 담당기관의 이번 훈련 근거와 운영자 판정을 요구한다',async()=>{
  const {h,host}=await setup();await cmd(h,host,{type:'end'});
  await cmd(h,host,{type:'improvement',objective:'judgment',owner:'fire',text:'판단 근거 기록 보완',due:'2026-11-30',retest:'현장 보고를 근거로 판단을 기록한다'});
  const next=await h.call({op:'retrain',id:host.id},host.token),people={};
  for(const o of next.config.orgs)people[o.id]=await join(h,next,o.id);
  await cmd(h,next,{type:'start'});
  await cmd(h,people.fire,{type:'decision',reason:'현장 신고를 재확인하기로 결정',evidence:[people.fire.reports[0].id]});
  await cmd(h,next,{type:'end'});
  const c={type:'verifyImprovement',id:'I1',verdict:'verified',reason:'이번 판단 기록에서 근거 선택을 확인',evidence:[]};
  assert.equal((await cmd(h,next,c)).http,400);
  assert.equal((await cmd(h,people.fire,c)).http,403);
  const events=(await read(h,next)).events;c.evidence=[events.find(e=>e.type==='started').id];
  assert.equal((await cmd(h,next,c)).http,400);
  c.evidence=[events.find(e=>e.type==='decision'&&e.org==='fire').id];
  const verified=await cmd(h,next,c);assert.equal(verified.http,200);assert.equal(verified.aar.improvements[0].status,'verified');assert.deepEqual(verified.aar.improvements[0].verification.evidence,c.evidence);
});
test('시나리오의 AI 사용 여부·실패를 명시하고 숨겨진 사실은 AI에 전송하지 않는다',async()=>{
  let sent;const h=harness({generate:async input=>{sent=input;return {brief:'가상 훈련 브리핑'};}});const p=await h.call({op:'prepare',config:{},useAI:true});assert.equal(p.source,'ai');assert.equal(sent.actualCount,undefined);assert.equal(sent.variant,undefined);
  const broken=harness({generate:async()=>{throw Error('offline');}});const fallback=await broken.call({op:'prepare',config:{},useAI:true});assert.equal(fallback.source,'template');assert.match(fallback.notice,/AI 생성 결과가 아닙니다/);
});
test('다른 출처와 만료된 방의 접근을 거부한다',async()=>{
  const h=harness();assert.equal((await h.call({op:'create',config:{}},null,{Origin:'https://other.test'})).http,403);const host=await create(h);h.step(8*24*60);assert.equal((await read(h,host)).http,404);
});
test('모의 결과 대기는 시간만으로 자동 성공 처리하지 않는다',()=>{
  const s=makeExercise({});s.status='running';participantCommand(s,'fire',{type:'request',to:'fire',action:'rescue',reason:'현장 지원'});participantCommand(s,'fire',{type:'accept',id:'Q1',reason:'수락'});participantCommand(s,'fire',{type:'startAction',id:'Q1'});advance(s,[],Date.now(),20);assert.equal(s.world.rescueComplete,false);assert.equal(s.requests[0].status,'in_progress');
});
