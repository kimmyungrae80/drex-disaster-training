import {VERSION,ACTIONS,DEFAULT_ORGS,OBJECTIVES} from './catalog.mjs';
export {VERSION,ACTIONS,DEFAULT_ORGS,OBJECTIVES} from './catalog.mjs';
export const clone = x => structuredClone(x);
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function text(v,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max)fail('입력 내용과 길이를 확인하세요.');return v.trim();}
const optional=(v,max)=>v===undefined||v===''?'':text(v,max);
export function configOf(input={}){
  const lat=Number(input.lat??37.5665),lng=Number(input.lng??126.978);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)fail('지도 좌표를 확인하세요.');
  const orgs=clone(input.orgs??DEFAULT_ORGS);
  if(!Array.isArray(orgs)||orgs.length<2||orgs.length>20)fail('참여기관은 2~20개로 구성하세요.');
  const ids=new Set();
  for(const o of orgs){if(!/^[a-z][a-z0-9_-]{0,30}$/.test(o.id)||ids.has(o.id))fail('기관 식별자가 중복되거나 올바르지 않습니다.');ids.add(o.id);o.name=text(o.name,60);if(!Array.isArray(o.capabilities)||o.capabilities.some(c=>!ACTIONS[c]))fail('기관의 모의 임무를 확인하세요.');o.capabilities=[...new Set(o.capabilities)];}
  const objectives=clone(input.objectives??OBJECTIVES);
  if(!Array.isArray(objectives)||objectives.length<1||objectives.length>3||new Set(objectives.map(o=>o.id)).size!==objectives.length)fail('훈련 목표를 1~3개 선택하세요.');
  for(const o of objectives){if(!OBJECTIVES.some(x=>x.id===o.id))fail('지원하는 관찰 항목을 선택하세요.');o.title=text(o.title,120);o.target=text(o.target,800);o.source=text(o.source,500);}
  const duration=Number(input.duration??40),secondsPerMinute=Number(input.secondsPerMinute??60);
  if(![20,40,60].includes(duration)||![5,15,60].includes(secondsPerMinute))fail('훈련시간과 시간 배속을 확인하세요.');
  const mode=input.mode??'practice',scope=input.scope??'multi';
  if(!['practice','exercise'].includes(mode)||!['solo','agency','multi'].includes(scope))fail('훈련 방식을 확인하세요.');
  const ownOrg=input.ownOrg??orgs[0].id;if(!ids.has(ownOrg))fail('본인 기관을 확인하세요.');
  return {location:text(input.location??'서울시 중구 일대',100),address:optional(input.address,200),lat,lng,duration,secondsPerMinute,mode,scope,ownOrg,orgs,objectives,simulateOthers:scope!=='multi'||input.simulateOthers===true,variant:input.variant==='detour'?'detour':'baseline',brief:optional(input.brief,2000),briefSource:input.briefSource==='ai'?'ai-reviewed':'reviewed-template'};
}
export function record(s,type,org,message,data={},visibility=[org]){
  const e={id:'E'+(s.events.length+1),time:s.time,type,org,message,...data,visibility};s.events.push(e);return e;
}
export function addReport(s,{org,message,site='facility',source='훈련 운영자',reliability='unconfirmed',origin='scenario',shared=false,action=null}){
  if(!s.config.orgs.some(o=>o.id===org))fail('수신 기관이 없습니다.');
  const r={id:'R'+(s.reports.length+1),org,text:text(message,2000),site,source:text(source,120),reliability,origin,shared,time:s.time,action};s.reports.push(r);return r;
}
export function knownReports(s,org){return s.reports.filter(r=>r.org===org||r.shared);}
export function makeExercise(config,now=Date.now()){
  const s={version:VERSION,config:configOf(config),status:'lobby',time:0,lastTick:now,reports:[],events:[],requests:[],decisions:[],adjudications:[],reviews:[],improvements:[],released:[],resources:{},baseline:null};
  const c=s.config;s.world={actualCount:12,reportedCount:8,countKnown:false,roadOpen:false,powerSafe:false,shelterReady:false,warningIssued:false,rescueComplete:false,weather:'집중호우 지속'};
  for(const o of c.orgs){s.resources[o.id]={capacity:1};let message='집중호우로 가상 시설에 고립 신고가 접수되었습니다. 담당 임무와 기관 간 지원 필요사항을 확인하세요.';
    if(o.capabilities.includes('verify'))message='신고자가 시설 내 8명이 있다고 전했습니다. 현장 인원은 아직 확인되지 않았습니다.';
    else if(o.capabilities.includes('traffic'))message='시설 진입도로 침수 신고가 접수됐습니다. 통행 가능 여부를 확인해야 합니다.';
    else if(o.capabilities.includes('isolate'))message='시설 배전설비 주변 침수 제보가 있습니다. 전기 안전 상태는 미확인입니다.';
    else if(o.capabilities.includes('shelter'))message='가상 대피시설의 수용 여력은 20명으로 계획돼 있습니다. 개설·인계 준비가 필요합니다.';
    else if(o.capabilities.includes('warning'))message='시설의 사전 등록 인원은 12명입니다. 현재 현장 인원과 동일한지는 확인이 필요합니다.';
    addReport(s,{org:o.id,message,source:'기관별 초기 상황카드',site:o.capabilities.includes('traffic')?'road':o.capabilities.includes('shelter')?'shelter':'facility'});
  }
  record(s,'created','control','훈련 목표와 기관별 초기 정보가 준비됐습니다.',{},['control']);return s;
}
function objectiveIds(s,input){const values=Array.isArray(input)?input:[];if(values.some(id=>!s.config.objectives.some(o=>o.id===id)))fail('훈련 목표를 확인하세요.');return [...new Set(values)];}
function evidence(s,org,input){const ids=Array.isArray(input)?input:[];if(ids.length>30)fail('근거는 30개까지 선택하세요.');const visible=knownReports(s,org);if(ids.some(id=>!visible.some(r=>r.id===id)))fail('본인이 열람할 수 있는 정보만 근거로 사용할 수 있습니다.',403);return ids.map(id=>clone(visible.find(r=>r.id===id)));}
export function participantCommand(s,org,c,origin='human'){
  if(!['share','report','verifyReport','decision','request','accept','decline','startAction','confirm','proposal'].includes(c?.type))fail('허용되지 않은 기관 조치입니다.',403);
  if(s.status!=='running')fail('훈련 진행 중에 수행하세요.');const own=s.config.orgs.find(o=>o.id===org);if(!own)fail('기관 권한이 없습니다.',403);
  if(c.type==='share'){
    const r=s.reports.find(r=>r.id===c.id);if(!r||r.org!==org)fail('본인 기관 정보만 공유할 수 있습니다.',403);if(!r.shared){r.shared=true;r.sharedAt=s.time;record(s,'share',org,'상황정보 공유: '+r.text,{reportId:r.id,origin},['all']);}return;
  }
  if(c.type==='report'){
    if(!['unconfirmed','confirmed','conflicting'].includes(c.reliability))fail('정보 확인 상태를 선택하세요.');
    const r=addReport(s,{org,message:c.text,source:text(c.source,120),reliability:c.reliability,origin,shared:c.shared===true,site:['road','shelter','facility'].includes(c.site)?c.site:'facility'});
    record(s,c.shared?'share':'report',org,'상황보고: '+r.text,{reportId:r.id,origin},c.shared?['all']:[org]);return;
  }
  if(c.type==='verifyReport'){
    const r=s.reports.find(r=>r.id===c.id);if(!r||r.org!==org)fail('본인 기관 정보만 확인 처리할 수 있습니다.',403);
    const before=clone(r);r.verification={reason:text(c.reason,1000),source:text(c.source,120),time:s.time};r.reliability='confirmed';
    record(s,'verification',org,'정보 확인: '+r.verification.reason,{reportId:r.id,before,origin},r.shared?['all']:[org]);return;
  }
  if(c.type==='decision'){
    const d={id:'D'+(s.decisions.length+1),org,time:s.time,reason:text(c.reason,2000),objectives:objectiveIds(s,c.objectives),evidence:evidence(s,org,c.evidence),origin};s.decisions.push(d);record(s,'decision',org,d.reason,{decisionId:d.id,origin},[org]);return;
  }
  if(c.type==='request'){
    const to=s.config.orgs.find(o=>o.id===c.to);if(!to)fail('요청 기관을 선택하세요.');if(!ACTIONS[c.action]||!to.capabilities.includes(c.action))fail('수신 기관에 배정된 모의 임무를 선택하세요.');
    if(s.requests.length>=300)fail('요청 한도에 도달했습니다.');
    const q={id:'Q'+(s.requests.length+1),from:org,to:to.id,action:c.action,reason:text(c.reason,1000),time:s.time,status:'requested',origin,evidence:evidence(s,org,c.evidence)};s.requests.push(q);record(s,'request',org,`${to.name}에 ${ACTIONS[c.action].name} 요청`,{requestId:q.id,origin},[org,to.id]);return;
  }
  if(['accept','decline','startAction','confirm'].includes(c.type)){
    const q=s.requests.find(q=>q.id===c.id);if(!q)fail('요청을 찾을 수 없습니다.');
    if(c.type==='confirm'){
      if(q.from!==org)fail('요청 기관만 결과를 확인할 수 있습니다.',403);if(q.status!=='result_reported')fail('결과 회신 후 확인하세요.');
      q.confirmation=text(c.reason,1000);q.confirmed=s.time;q.status='confirmed';q.confirmedOrigin=origin;record(s,'confirm',org,q.confirmation,{requestId:q.id,origin},[q.from,q.to]);return;
    }
    if(q.to!==org)fail('수신 기관만 처리할 수 있습니다.',403);
    if(c.type==='accept'||c.type==='decline'){
      if(q.status!=='requested')fail('이미 처리된 요청입니다.');q.reply=text(c.reason,1000);q.responded=s.time;q.responseOrigin=origin;q.status=c.type==='accept'?'accepted':'declined';
      record(s,c.type,org,q.reply,{requestId:q.id,origin},[q.from,q.to]);return;
    }
    if(q.status!=='accepted')fail('수락한 요청만 착수할 수 있습니다.');
    if(s.requests.filter(r=>r.to===org&&r.status==='in_progress').length>=s.resources[org].capacity)fail('가용 팀이 없습니다. 진행 중인 조치 결과를 기다리세요.');
    q.status='in_progress';q.started=s.time;q.remaining=ACTIONS[q.action].minutes;q.executionOrigin=origin;
    record(s,'action_started',org,ACTIONS[q.action].name+' 착수',{requestId:q.id,origin},[q.from,q.to]);return;
  }
  if(c.type==='proposal'){
    const a={id:'A'+(s.adjudications.length+1),org,time:s.time,text:text(c.text,2000),reason:text(c.reason,1000),evidence:evidence(s,org,c.evidence),status:'pending',origin};s.adjudications.push(a);record(s,'proposal',org,'운영자 판단 요청: '+a.text,{proposalId:a.id,origin},[org]);return;
  }
  fail('허용되지 않은 기관 조치입니다.',403);
}
const worldReport=(s,q,message)=>{
  const r=addReport(s,{org:q.to,message,source:'모의 현장 회신 · 교육용 규칙',reliability:'confirmed',origin:q.executionOrigin==='simulated'?'simulated':'simulation',action:q.action,site:ACTIONS[q.action].site});
  q.result=message;q.resultReportId=r.id;q.finished=s.time;q.status='result_reported';record(s,'result',q.to,message,{requestId:q.id,reportId:r.id,origin:q.executionOrigin},[q.from,q.to]);
  if(q.from!==q.to)addReport(s,{org:q.from,message,source:s.config.orgs.find(o=>o.id===q.to).name+' 모의 결과 회신',reliability:'confirmed',origin:r.origin,action:q.action,site:r.site});
};
function finish(s,q){const a=ACTIONS[q.action];s.world[a.effect]=true;let message=a.name+'의 모의 결과가 도착했습니다.';
  if(q.action==='verify')message=`현장 확인 인원은 ${s.world.actualCount}명입니다. 최초 신고 ${s.world.reportedCount}명과 다릅니다. 확인 결과의 공유가 필요합니다.`;
  if(q.action==='rescue')message=`현장 ${s.world.actualCount}명 구조·대피 지원 모의 완료. 요청 기관의 결과 확인과 인계 판단이 필요합니다.`;
  worldReport(s,q,message);
}
function actors(s,bots){
  for(const org of bots){
    for(const r of s.reports.filter(r=>r.org===org&&!r.shared&&s.time-r.time>=1))participantCommand(s,org,{type:'share',id:r.id},'simulated');
    for(const q of s.requests.filter(q=>q.to===org&&q.status==='requested'&&s.time-q.time>=1))participantCommand(s,org,{type:'accept',id:q.id,reason:'모의기관이 요청을 접수했습니다.'},'simulated');
    for(const q of s.requests.filter(q=>q.to===org&&q.status==='accepted')){try{participantCommand(s,org,{type:'startAction',id:q.id},'simulated');}catch(e){if(e.status!==400)throw e;}}
    for(const q of s.requests.filter(q=>q.from===org&&q.status==='result_reported'))participantCommand(s,org,{type:'confirm',id:q.id,reason:'모의기관 결과 수신 확인'},'simulated');
  }
}
export function advance(s,bots,now=Date.now(),manual=0){
  if(s.status!=='running')return false;const count=manual||Math.floor((now-s.lastTick)/(s.config.secondsPerMinute*1000));if(count<1)return false;
  const n=Math.min(count,s.config.duration-s.time);
  for(let i=0;i<n;i++){
    s.time++;
    if(s.config.variant==='detour'&&s.time===8){s.world.roadOpen=false;for(const o of s.config.orgs.filter(o=>o.capabilities.includes('traffic')))addReport(s,{org:o.id,message:'우회 진입로에 추가 침수가 확인됐습니다. 통행 상태를 다시 확인해야 합니다.',site:'road',source:'운영 시나리오',reliability:'confirmed'});record(s,'world','control','재훈련 변형: 진입로 조건 변화',{},['control']);}
    for(const q of s.requests.filter(q=>q.status==='in_progress')){
      const unmet=(ACTIONS[q.action].requires||[]).filter(k=>!s.world[k]);
      if(unmet.length){if(!q.blocked){q.blocked=true;worldReportPending(s,q);}}else{q.blocked=false;q.remaining--;if(q.remaining<=0)finish(s,q);}
    }
    actors(s,bots);
    if(s.time>=s.config.duration){s.status='ended';record(s,'ended','control','설정된 훈련시간 종료',{},['all']);}
  }
  s.lastTick=manual?now:s.lastTick+n*s.config.secondsPerMinute*1000;return n>0;
}
function worldReportPending(s,q){const message='모의 현장 회신: 진입로·전기 안전·대피시설 준비 중 미확인 조건이 있어 현장 지원을 대기합니다. 담당기관과 확인하세요.';addReport(s,{org:q.to,message,source:'모의 현장',origin:'simulation'});record(s,'blocked',q.to,message,{requestId:q.id,origin:q.executionOrigin},[q.from,q.to]);}
export function controllerCommand(s,c){
  if(c.type==='inject'){
    if(!['running','paused'].includes(s.status))fail('훈련 진행 중 상황을 부여하세요.');
    const r=addReport(s,{org:c.org,message:c.text,source:text(c.source||'훈련 통제부',120),reliability:['confirmed','conflicting'].includes(c.reliability)?c.reliability:'unconfirmed',origin:'controller',site:['road','shelter'].includes(c.site)?c.site:'facility'});
    record(s,'inject','control','기관별 추가 상황 전달',{reportId:r.id},['control']);return;
  }
  if(c.type==='adjudicate'){
    if(!['running','paused'].includes(s.status))fail('훈련 진행 중 판정하세요.');const a=s.adjudications.find(a=>a.id===c.id);if(!a||a.status!=='pending')fail('검토할 제안이 없습니다.');
    if(!['approved','rejected'].includes(c.verdict))fail('검토 결과를 선택하세요.');const reason=text(c.reason,2000);const effects=['none','roadOpen','powerSafe','shelterReady','warningIssued','rescueComplete'];if(!effects.includes(c.effect??'none'))fail('허용되지 않은 모의 상태 변경입니다.');
    a.status=c.verdict;a.reviewReason=reason;a.reviewed=s.time;a.effect=c.verdict==='approved'?(c.effect??'none'):'none';
    if(a.effect!=='none')s.world[a.effect]=true;
    addReport(s,{org:a.org,message:`운영자 검토 ${a.status==='approved'?'승인':'보완 요청'}: ${reason}`,source:'훈련 운영자',origin:'controller',reliability:'confirmed'});record(s,'adjudication','control',reason,{proposalId:a.id,effect:a.effect},[a.org]);return;
  }
  if(c.type==='review'){
    if(s.status!=='ended')fail('종료 후 강평을 검토하세요.');if(!s.config.objectives.some(o=>o.id===c.objective))fail('목표를 확인하세요.');if(!['met','improve','unknown'].includes(c.verdict))fail('검토 결과를 확인하세요.');
    const ids=Array.isArray(c.evidence)?c.evidence:[];if(!ids.length||ids.some(id=>!s.events.some(e=>e.id===id)))fail('근거 기록을 1개 이상 선택하세요.');
    s.reviews.push({id:'V'+(s.reviews.length+1),objective:c.objective,verdict:c.verdict,reason:text(c.reason,2000),evidence:ids,time:s.time});return;
  }
  if(c.type==='improvement'){
    if(s.status!=='ended')fail('종료 후 개선과제를 작성하세요.');if(!s.config.objectives.some(o=>o.id===c.objective)||!s.config.orgs.some(o=>o.id===c.owner))fail('목표와 담당기관을 확인하세요.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(c.due)||!Number.isFinite(Date.parse(c.due)))fail('완료 기한을 선택하세요.');
    s.improvements.push({id:'I'+(s.improvements.length+1),objective:c.objective,owner:c.owner,due:c.due,text:text(c.text,1000),retest:text(c.retest,1000),status:'open'});return;
  }
  if(c.type==='completeImprovement'){
    if(s.status!=='ended')fail('종료 후 개선조치를 기록하세요.');const item=s.improvements.find(x=>x.id===c.id);if(!item||item.status!=='open')fail('진행 중인 개선과제를 선택하세요.');item.status='completed';item.completionNote=text(c.reason,1000);return;
  }
  if(c.type==='verifyImprovement'){
    if(s.status!=='ended')fail('재훈련 종료 후 근거를 검토하세요.');
    const item=s.improvements.find(x=>x.id===c.id);if(!item||item.status!=='retest')fail('재검증할 개선과제를 선택하세요.');
    if(!['verified','needs_work'].includes(c.verdict))fail('재검증 결과를 선택하세요.');
    const ids=Array.isArray(c.evidence)?c.evidence:[];
    if(!ids.length||ids.some(id=>!s.events.some(e=>e.id===id&&e.origin==='human'&&e.org===item.owner)))fail('담당기관의 이번 훈련 행동 기록을 1개 이상 선택하세요.');
    item.verification={verdict:c.verdict,reason:text(c.reason,1000),evidence:ids,time:s.time};item.status=c.verdict;return;
  }
  fail('통제자는 기관 조치를 대신 수행하지 않습니다.',403);
}
export function evaluation(s,org=null){
  const events=s.events.filter(e=>!org||e.visibility.includes('all')||e.visibility.includes(org));
  const decisions=s.decisions.filter(d=>(!org||d.org===org)&&d.origin==='human');
  const requests=s.requests.filter(q=>(!org||q.from===org||q.to===org));
  const criteria=s.config.objectives.map(o=>{
    let evidence=[];
    if(o.id==='information')evidence=events.filter(e=>e.origin==='human'&&['verification','share'].includes(e.type)).map(e=>e.id);
    if(o.id==='coordination')evidence=events.filter(e=>e.origin==='human'&&['request','accept','confirm'].includes(e.type)).map(e=>e.id);
    if(o.id==='judgment')evidence=events.filter(e=>e.origin==='human'&&['decision','confirm','proposal'].includes(e.type)).map(e=>e.id);
    const review=org?null:[...s.reviews].reverse().find(r=>r.objective===o.id);
    return {...o,evidence,status:review?review.verdict:evidence.length?'review':'unknown',review};
  });
  const realLoops=requests.filter(q=>q.from!==q.to&&q.status==='confirmed'&&q.origin==='human'&&q.responseOrigin==='human'&&q.executionOrigin==='human'&&q.confirmedOrigin==='human');
  return {criteria,decisions:clone(decisions),events:clone(events),metrics:{humanClosedLoops:realLoops.length,simulatedLoops:requests.filter(q=>q.status==='confirmed'&&(q.origin==='simulated'||q.responseOrigin==='simulated'||q.confirmedOrigin==='simulated')).length,pending:requests.filter(q=>!['confirmed','declined'].includes(q.status)).length,averageResponseMinutes:(()=>{const a=requests.filter(q=>q.origin==='human'&&q.responseOrigin==='human'&&Number.isFinite(q.responded));return a.length?Math.round(a.reduce((n,q)=>n+q.responded-q.time,0)/a.length*10)/10:null;})()},improvements:clone(s.improvements.filter(i=>!org||i.owner===org)),baseline:org?null:s.baseline,note:'교육용 관찰 초안입니다. 기록 미확인은 미수행·실패 판정이 아닙니다. 속도만으로 역량을 평가하지 않으며, 운영자가 근거를 검토합니다. 모의기관 실적은 실제 기관 협업 실적에서 제외합니다.'};
}
export function projected(s,member,members){
  const control=member.kind==='control',org=member.org,humans=new Set(members.filter(m=>m.kind==='participant').map(m=>m.org));
  const activeBots=s.config.simulateOthers?s.config.orgs.filter(o=>!humans.has(o.id)).map(o=>o.id):[];
  // Explicit allow-list: future scenario/world fields must never leak through config spreading.
  const c=s.config;const config={location:c.location,address:c.address,lat:c.lat,lng:c.lng,duration:c.duration,secondsPerMinute:c.secondsPerMinute,mode:c.mode,scope:c.scope,ownOrg:c.ownOrg,orgs:c.orgs,objectives:c.objectives,brief:c.brief,briefSource:c.briefSource,simulateOthers:c.simulateOthers};
  return {version:VERSION,status:s.status,time:s.time,config,member,participants:c.orgs.map(o=>({...o,mode:humans.has(o.id)?'human':activeBots.includes(o.id)?'simulated':'unassigned',members:members.filter(m=>m.org===o.id).map(m=>m.name)})),reports:clone(control?s.reports:knownReports(s,org)),requests:clone(control?s.requests:s.requests.filter(q=>q.from===org||q.to===org)),decisions:clone(control?s.decisions:s.decisions.filter(d=>d.org===org)),events:clone(s.events.filter(e=>control||e.visibility.includes('all')||e.visibility.includes(org))),resources:clone(control?s.resources:{[org]:s.resources[org]}),adjudications:clone(control?s.adjudications:s.adjudications.filter(a=>a.org===org)),world:control?clone(s.world):null,aar:s.status==='ended'?evaluation(s,control?null:org):null,improvements:clone(s.improvements.filter(i=>control||i.owner===org))};
}
