export const ROOM_VERSION='DREX-ROOM-1';
export const ORGS={hq:'지자체 상황총괄',fire:'소방',police:'경찰',health:'보건·의료',works:'도로·시설',power:'전력',gas:'가스',water:'상하수도',telecom:'통신',transport:'교통·수송',welfare:'대피·구호',env:'환경',military:'군 지원'};
export const JOBS={
 alert:{org:'hq',name:'상황 전파·주민 안내',minutes:2,site:'center'},
 rescue:{org:'fire',name:'고립 인원 구조',minutes:8,site:'rescue'},
 control:{org:'police',name:'위험구역 출입 통제',minutes:4,site:'rescue'},
 medical:{org:'health',name:'구조 인원 의료지원',minutes:6,site:'hospital'},
 road:{org:'works',name:'접근로 복구',minutes:8,site:'road'},
 power:{org:'power',name:'전기 위험 확인·안전조치',minutes:5,site:'rescue'},
 gas:{org:'gas',name:'가스시설 점검·안전조치',minutes:5,site:'care'},
 water:{org:'water',name:'대피시설 급수 지원',minutes:6,site:'shelter'},
 telecom:{org:'telecom',name:'긴급 통신망 확보',minutes:5,site:'center'},
 evacuate:{org:'transport',name:'이동약자 수송',minutes:8,site:'care'},
 shelter:{org:'welfare',name:'대피소 개설·수용 확대',minutes:5,site:'shelter'},
 contain:{org:'env',name:'오염 확산 방지',minutes:7,site:'road'},
 support:{org:'military',name:'구조 지원인력 파견',minutes:7,site:'rescue'}
};
export const ORG_GUIDE={hq:'정보를 종합하고 기관 간 우선순위를 조정합니다. 본인 대신 다른 기관의 조치를 수행하지 않습니다.',fire:'고립 인원의 구조와 현장 안전을 판단합니다. 전력·경찰의 확인을 요청하고 결과를 보고합니다.',police:'위험구역 출입과 교통을 통제하고 접근로 정보를 공유합니다.',health:'구조 인원을 인계받아 의료지원을 조정합니다. 구조 완료 보고 후 수요를 확인하세요.',works:'접근로 상태를 확인하고 복구합니다. 복구 전후 상태를 기관에 공유하세요.',power:'전기 위험을 확인하고 안전조치를 보고합니다. 현장 구조기관과 협의하세요.',gas:'가스시설 안전을 점검하고 대피·구조기관에 결과를 알립니다.',water:'대피소의 급수 수요를 확인하고 지원합니다.',telecom:'기관 간 연락망을 확보하고 통신 상태를 공유합니다.',transport:'이동약자를 수송합니다. 대피소 수용 여력과 도로 상태를 확인하세요.',welfare:'대피소를 개설하고 수용 여력·구호 수요를 알립니다.',env:'재난에 따른 오염 위험을 확인하고 확산 방지 조치를 수행합니다.',military:'지원 요청을 검토하고 구조기관의 부족한 인력을 지원합니다.'};
const copy=x=>structuredClone(x);
export function roomError(message,status=400){return Object.assign(new Error(message),{status});}
export function cleanText(v,max=1000){if(typeof v!=='string'||!v.trim()||v.length>max)throw roomError('입력 내용과 길이를 확인하세요.');return v.trim();}
export function buildScenario(input={},seed=Date.now()){
 const location=cleanText(input.location||'단양읍 일대',100),kind=input.kind||'flood';if(!['flood','fire'].includes(kind))throw roomError('지원하는 재난 유형을 선택하세요.');
 const duration=Number(input.duration||40);if(![30,40,60].includes(duration))throw roomError('훈련 시간은 30·40·60분입니다.');
 const difficulty=['basic','complex'].includes(input.difficulty)?input.difficulty:'basic';const n=Math.abs(Number(seed)||1)%997;
 const trapped=6+(n%3)*2,evacuees=12+(n%3)*6,secondsPerMinute=Number(input.secondsPerMinute||15);if(![5,15,30,60].includes(secondsPerMinute))throw roomError('시간 배속을 확인하세요.');
 const lat=Number(input.lat??36.99),lng=Number(input.lng??128.365);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)throw roomError('좌표 범위를 확인하세요.');
 return {version:ROOM_VERSION,id:'S'+n,seed:n,location,kind,duration,difficulty,secondsPerMinute,lat,lng,trapped,evacuees,source:'template',title:location+' '+(kind==='flood'?'집중호우·침수':'시설화재·연기 확산')+' 대응훈련',brief:`${location}에서 ${kind==='flood'?'호우로 인한 침수':'시설 화재'}가 발생했습니다. 고립 신고 ${trapped}명과 이동약자 ${evacuees}명의 대피 수요가 있습니다. 기관별로 받은 정보를 확인하고 우선순위와 지원을 조정하세요.`,objectives:cleanText(input.objectives||'기관별 상황 공유, 안전 확인, 자원 배분과 조치 결과 확인',500),notes:'실제 지역 위에 배치한 가상 사건입니다. 인원·소요시간·위험 변화는 교육용 가정이며 실제 피해 예측이 아닙니다.'};
}
function event(s,type,org,text,data={}){const e={id:'E'+(s.events.length+1),time:s.time,type,org,text,...data};s.events.push(e);return e;}
function report(s,org,text,site='center',source='model') {const r={id:'R'+(s.reports.length+1),org,text,site,source,time:s.time,shared:false};s.reports.push(r);return r;}
export function makeRoom(scenario,mode='practice',now=Date.now()){
 if(!['practice','exercise'].includes(mode))throw roomError('훈련 모드를 확인하세요.');
 const s={version:ROOM_VERSION,scenario:copy(scenario),mode,status:'lobby',time:0,lastTick:now,resources:Object.fromEntries(Object.keys(ORGS).map(o=>[o,{capacity:1,jobs:[]}])) ,world:{trapped:scenario.trapped,evacuees:scenario.evacuees,rescued:0,evacuated:0,treated:0,waitingMedical:0,shelterCapacity:6,closed:false,roadBlocked:false,alerted:false,powerSafe:false,gasSafe:false,waterReady:false,telecomReady:false,contained:false,supported:false,exposure:0},requests:[],reports:[],events:[],decisions:[],botRuns:{},nextAutoReport:0};
 const initial={hq:scenario.brief,fire:`고립 ${scenario.trapped}명 신고. 구조팀 1개 가용. 현장 전기 위험·출입 통제 확인이 필요합니다.`,police:'위험구역 통제 미실시. 접근로 통행 가능, 현장 상태 확인 필요.',health:'의료지원팀 1개 가용. 구조 인원 인계 전 수요 확인 필요.',works:'주요 접근로 통행 가능. 재난 진행 시 장애 발생 가능.',power:'재난 현장의 전기 위험 미확인. 구조기관과 안전조치 협의 필요.',gas:'인근 가스시설 안전 상태 미확인. 현장 점검 필요.',water:'대피시설 급수 지원 준비 필요.',telecom:'긴급 기관 연락망 확보 필요.',transport:`이동약자 ${scenario.evacuees}명 수송 필요. 차량 1대, 1회 최대 6명.`,welfare:'현재 대피소 수용 여력 6명. 개설 작업으로 12명씩 확대 가능.',env:'재난에 따른 오염 확산 가능성. 현장 확인 및 방지 필요.',military:'지원팀 1개 가용. 파견 시 소방 구조팀 1개를 추가 지원할 수 있습니다.'};
 for(const [org,text]of Object.entries(initial)){const job=Object.values(JOBS).find(j=>j.org===org);report(s,org,text,job.site);}
 event(s,'created','control','시나리오 구성 및 기관별 초기 보고 준비');return s;
}
export function knownReports(s,org){return s.reports.filter(r=>r.shared||r.org===org);}
function needs(s,job){const w=s.world;return {alert:!w.alerted,rescue:w.trapped>0,control:!w.closed,medical:w.waitingMedical>0,road:w.roadBlocked,power:!w.powerSafe,gas:!w.gasSafe,water:!w.waterReady,telecom:!w.telecomReady,evacuate:w.evacuees>0,shelter:w.shelterCapacity-w.evacuated<w.evacuees,contain:!w.contained,support:!w.supported}[job];}
function canDispatch(s,org,job){const spec=JOBS[job];if(!spec||spec.org!==org)throw roomError('본인 기관의 임무만 수행할 수 있습니다.',403);if(!needs(s,job))throw roomError('현재 이 작업의 대상이 없습니다. 최신 상황을 확인하세요.');if(s.resources[org].jobs.length>=s.resources[org].capacity)throw roomError('가용 자원이 없습니다. 현재 임무 완료 또는 지원을 기다리세요.');if(s.resources[org].jobs.some(j=>j.job===job)&&!['rescue','evacuate','medical'].includes(job))throw roomError('같은 임무가 이미 진행 중입니다.');}
function dispatch(s,org,job,requestId=null,source='human'){
 canDispatch(s,org,job);const j=JOBS[job];const delay=s.world.roadBlocked&&!['road','alert','telecom'].includes(job)?4:0;
 s.resources[org].jobs.push({id:'J'+(s.events.length+1),job,remaining:j.minutes+delay,started:s.time,requestId,detoured:!!delay});event(s,'dispatch',org,`${j.name} 시작. 예상 ${j.minutes+delay}분.`,{source});
 if(delay)report(s,org,`${j.name}: 접근로 단절로 4분 추가.`,j.site,source);
}
export function applyRoomCommand(s,org,c,source='human'){
 if(s.status!=='running')throw roomError('훈련 시작 후 조치할 수 있습니다.');if(!ORGS[org])throw roomError('기관 권한이 없습니다.',403);if(!c||typeof c.type!=='string')throw roomError('조치 내용을 확인하세요.');
 const evidence=knownReports(s,org).map(r=>r.id);let reason='';
 if(c.type==='share'){const r=s.reports.find(r=>r.id===c.id);if(!r||r.org!==org)throw roomError('본인 기관의 보고만 공유할 수 있습니다.',403);if(r.shared)return;r.shared=true;event(s,'share',org,r.text,{reportId:r.id,source});}
 else if(c.type==='request'){
  const job=JOBS[c.job];if(!job)throw roomError('임무를 선택하세요.');reason=cleanText(c.reason);
  if(s.requests.filter(r=>r.from===org&&r.status==='pending').length>=30)throw roomError('미처리 요청이 많습니다. 회신부터 확인하세요.');
  const r={id:'Q'+(s.requests.length+1),job:c.job,from:org,to:job.org,time:s.time,status:'pending',reason,source};s.requests.push(r);event(s,'request',org,ORGS[job.org]+'에 '+job.name+' 요청',{requestId:r.id,to:job.org,source});
 }else if(c.type==='accept'||c.type==='decline'){
  const r=s.requests.find(r=>r.id===c.id);if(!r||r.to!==org)throw roomError('본인 기관에 접수된 요청만 처리할 수 있습니다.',403);if(r.status!=='pending')throw roomError('이미 처리된 요청입니다.');
  if(c.type==='accept'){dispatch(s,org,r.job,r.id,source);r.status='active';r.accepted=s.time;}
  else{r.reply=cleanText(c.reason);r.status='declined';event(s,'decline',org,r.reply,{requestId:r.id,to:r.from,source});}
 }else if(c.type==='dispatch'){reason=cleanText(c.reason);dispatch(s,org,c.job,null,source);}
 else if(c.type==='report'){reason=cleanText(c.text,2000);report(s,org,reason,Object.values(JOBS).find(j=>j.org===org).site,source);event(s,'report',org,'기관 상황보고 작성',{source});}
 else if(c.type==='decision'){reason=cleanText(c.reason,2000);event(s,'decision',org,reason,{source});}
 else throw roomError('허용되지 않은 조치입니다.',403);
 s.decisions.push({time:s.time,org,type:c.type,reason,source,evidence,eventId:s.events.at(-1)?.id});
}
function finishJob(s,org,j){const w=s.world;let detail='';
 if(j.job==='rescue'){const n=Math.min(6,w.trapped);w.trapped-=n;w.rescued+=n;w.waitingMedical+=n;detail=`${n}명 구조. 잔류 ${w.trapped}명. 의료 인계 협의 필요.`;report(s,'health',`구조 ${n}명 발생. 의료지원 대기 ${w.waitingMedical}명.`, 'hospital');}
 if(j.job==='evacuate'){const n=Math.min(6,w.evacuees,Math.max(0,w.shelterCapacity-w.evacuated));w.evacuees-=n;w.evacuated+=n;detail=`${n}명 대피 완료. 잔류 ${w.evacuees}명. 대피소 수용 여력 ${w.shelterCapacity-w.evacuated}명.`;report(s,'welfare',detail,'shelter');}
 if(j.job==='medical'){const n=Math.min(6,w.waitingMedical);w.waitingMedical-=n;w.treated+=n;detail=`${n}명 의료지원 인계. 대기 ${w.waitingMedical}명.`;}
 if(j.job==='shelter'){w.shelterCapacity+=12;detail=`대피소 총 수용 ${w.shelterCapacity}명, 잔여 ${w.shelterCapacity-w.evacuated}명.`;}
 if(j.job==='support'){w.supported=true;s.resources.fire.capacity+=1;detail='소방에 구조팀 1개 추가 지원.';report(s,'fire',detail,'rescue');}
 const flags={alert:'alerted',control:'closed',road:'roadBlocked',power:'powerSafe',gas:'gasSafe',water:'waterReady',telecom:'telecomReady',contain:'contained'};if(flags[j.job])w[flags[j.job]]=j.job!=='road';
 const msg=JOBS[j.job].name+' 완료. '+detail;report(s,org,msg,JOBS[j.job].site);event(s,'complete',org,msg,{job:j.job});
 if(j.requestId){const r=s.requests.find(r=>r.id===j.requestId);r.status='done';r.completed=s.time;r.result=msg;}
}
function automaticActors(s,botOrgs){
 for(const org of botOrgs){
  for(const r of s.reports.filter(r=>r.org===org&&!r.shared))applyRoomCommand(s,org,{type:'share',id:r.id},'auto');
  for(const r of s.requests.filter(r=>r.to===org&&r.status==='pending'&&s.time-r.time>=2)){
   try{applyRoomCommand(s,org,{type:'accept',id:r.id},'auto');}catch(e){if(!needs(s,r.job))applyRoomCommand(s,org,{type:'decline',id:r.id,reason:'현장 확인 결과 현재 작업 대상이 없습니다. 최신 보고를 확인해 주세요.'},'auto');}
  }
  // At most one outstanding request for each capability; human organizations act for themselves.
  if(s.time===1&&org==='hq')for(const [job,j]of Object.entries(JOBS))if(!botOrgs.includes(j.org))applyRoomCommand(s,org,{type:'request',job,reason:'본인 기관의 현장 수요를 확인하고 조치 가능 여부를 회신해 주세요.'},'auto');
  for(const [job,j]of Object.entries(JOBS))if(j.org===org&&needs(s,job)&&s.time>=2&&(s.botRuns[job]||0)<4&&!s.requests.some(r=>r.to===org&&r.status==='pending')){
   try{applyRoomCommand(s,org,{type:'dispatch',job,reason:'미참여 기관의 규칙 기반 자동 대응'},'auto');s.botRuns[job]=(s.botRuns[job]||0)+1;}catch{}
  }
 }
}
export function tickRoom(s,botOrgs,now=Date.now(),manualMinutes=0){
 if(s.status!=='running')return false;const count=manualMinutes||Math.floor((now-s.lastTick)/(s.scenario.secondsPerMinute*1000));if(count<=0)return false;
 const n=Math.min(count,s.scenario.duration-s.time);for(let i=0;i<n;i++){
  s.time++;
  if(s.time===Math.floor(s.scenario.duration*.2)){s.world.roadBlocked=true;report(s,'works',s.scenario.kind==='flood'?'토사·침수로 접근로 단절. 복구 필요.':'화재 잔해로 접근로 단절. 복구 필요.','road');report(s,'police','접근로 단절 확인. 우회 안내 필요.','road');event(s,'hazard','control','접근로 단절 발생');}
  if(s.time%5===0&&!s.world.closed){const n=s.world.alerted?1:2;s.world.trapped+=n;report(s,'fire',`통제 전 추가 고립 ${n}명. 총 잔류 ${s.world.trapped}명.`,'rescue');event(s,'hazard','control',`출입 미통제 → 추가 고립 ${n}명`);}
  for(const [org,res]of Object.entries(s.resources)){
   for(const j of res.jobs){if(s.world.roadBlocked&&!j.detoured&&!['road','alert','telecom'].includes(j.job)){j.remaining+=4;j.detoured=true;report(s,org,JOBS[j.job].name+' 우회로 4분 지연.',JOBS[j.job].site);}j.remaining--;if(j.remaining<=0)finishJob(s,org,j);}
   res.jobs=res.jobs.filter(j=>j.remaining>0);
  }
  if(s.time>=10)s.world.exposure+=s.world.trapped+s.world.evacuees+(s.world.powerSafe?0:2)+(s.world.gasSafe?0:2)+(s.world.contained?0:2);
  automaticActors(s,botOrgs);
  if(s.time>=s.scenario.duration){s.status='ended';event(s,'ended','control','설정된 훈련시간 종료');}
 }
 s.lastTick=manualMinutes?now:s.lastTick+n*s.scenario.secondsPerMinute*1000;return n>0;
}
export function roomAAR(s,org=null){
 const orgs=org?[org]:Object.keys(ORGS);return {title:s.scenario.title,mode:s.mode,time:s.time,world:org?null:copy(s.world),criteria:orgs.map(o=>{
  const ev=s.events.filter(e=>e.org===o),ds=s.decisions.filter(d=>d.org===o&&d.source==='human');return {org:o,checks:[{name:'상황정보 공유',met:ev.some(e=>e.type==='share'&&e.source==='human'),ids:ev.filter(e=>e.type==='share'&&e.source==='human').map(e=>e.id)},{name:'판단 근거 기록',met:ds.some(d=>d.reason),ids:ds.filter(d=>d.reason).map(d=>d.eventId)},{name:'기관 협조 요청·회신',met:ev.some(e=>['request','decline'].includes(e.type)&&e.source==='human')||ds.some(d=>d.type==='accept'),ids:ds.filter(d=>['request','accept','decline'].includes(d.type)).map(d=>d.eventId)},{name:'본인 기관 조치 결과 확인',met:ds.some(d=>d.type==='share'&&s.reports.find(r=>r.id===s.events.find(e=>e.id===d.eventId)?.reportId)?.text.includes('완료')),ids:ev.filter(e=>e.type==='complete').map(e=>e.id)}]};}),decisions:s.decisions.filter(d=>!org||d.org===org).map(d=>({...d,reports:d.evidence.map(id=>s.reports.find(r=>r.id===id)).filter(Boolean).map(r=>({id:r.id,time:r.time,text:r.text,org:r.org}))})),note:'기록에 근거한 점검 초안입니다. 미확인은 실패 판정이 아닙니다. 기관별 공식 평가점검표와 전문가 검토가 필요합니다.'};
}
