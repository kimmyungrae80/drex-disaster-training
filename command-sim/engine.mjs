// DREX CPX reference model 0.1. Deterministic, deliberately coarse training rules.
export const VERSION='CPX-0.1';
export const ROLES={hq:'상황총괄',fire:'소방',police:'경찰',health:'보건',works:'시설·대피지원'};
export const PLACES={underpass:'하천변 지하차도',care:'강변 요양시설',road:'동측 연결도로',hospital:'지역 의료거점'};
export const TASKS={
 rescue:{name:'고립 인원 구조·이송',owner:'fire',place:'underpass',resource:'ambulance',travel:5,work:5},
 evacuate:{name:'이동약자 대피·이송',owner:'fire',place:'care',resource:'ambulance',travel:5,work:10},
 close:{name:'지하차도 진입 통제',owner:'police',place:'underpass',resource:'patrol',travel:3,work:2},
 clear:{name:'연결도로 장애물 제거',owner:'works',place:'road',resource:'crew',travel:4,work:6},
 receive:{name:'의료거점 수용 준비',owner:'health',place:'hospital',resource:'medical',travel:0,work:5}
};
export const GUIDES={
 hq:['기관별 초기 보고를 모으세요.','보고 시각과 미확인 내용을 구분하고 공동 우선순위를 기록하세요.','소방 차량은 한 대입니다. 구조와 이동약자 대피를 동시에 수행할 수 없습니다.','소방에 임무를 요청한 뒤 소방 역할에서 수락하고 실행 결과를 공유하세요.'],
 fire:['고립 신고의 인원과 위치를 확인하세요.','가용 이송팀을 확인하고 구조·대피 중 우선 임무를 판단하세요.','수락하면 이동과 작업에 시간이 소요됩니다. 지원이 어려우면 사유와 대안을 남기세요.','완료 보고를 상황총괄과 공유하고 다음 임무를 수락하세요.'],
 police:['진입로 상태 보고를 확인하세요.','통제 임무를 요청·수락하면 순찰팀이 출동합니다.','통제 완료 전에는 추가 차량 유입이 발생할 수 있습니다.','통제 완료와 도로 단절 정보를 기관에 공유하세요.'],
 health:['의료거점 수용 여력을 확인하세요.','수용 준비를 실행하고 이송 예정 인원과 시점을 협의하세요.','병상 제약과 준비 상태를 공동상황판에 공유하세요.','구조·대피 완료가 의료 인계 완료와 같은 의미는 아닙니다.'],
 works:['요양시설 이동약자 보고를 공유하세요.','소방에 대피·이송을 요청하고 수송 가능 시점을 확인하세요.','연결도로가 단절되면 정비팀의 복구 임무를 실행하세요.','접근로 변화가 이동 중인 다른 자원에 미치는 영향을 확인하세요.']
};
const clone=x=>structuredClone(x);
function log(s,text,kind='event'){s.log.push({id:s.log.length+1,time:s.time,kind,text});}
function report(s,role,text,place=null){s.reports.push({id:'R'+(s.reports.length+1),time:s.time,role,text,place,shared:false});}
export function create(mode='practice'){
 if(!['practice','exercise'].includes(mode))throw Error('훈련 모드가 올바르지 않습니다.');
 const s={version:VERSION,mode,time:0,ended:false,world:{trapped:6,evacuees:12,rescued:0,evacuated:0,closed:false,blocked:false,medicalReady:false,exposure:0},resources:[{id:'ambulance',name:'구조·이송팀 1대',owner:'fire',job:null},{id:'patrol',name:'순찰팀 1개',owner:'police',job:null},{id:'crew',name:'도로 정비팀 1개',owner:'works',job:null},{id:'medical',name:'의료지원팀 1개',owner:'health',job:null}],requests:[],reports:[],log:[],commands:[]};
 report(s,'hq','호우경보 가정. 기관별 현장 정보 확인과 공동 우선순위 결정이 필요합니다.');
 report(s,'fire','지하차도 고립 6명 신고. 현장 미확인. 구조·이송팀 1대 가용.','underpass');
 report(s,'police','지하차도 진입 통제 미실시. 동측 연결도로 통행 가능.','road');
 report(s,'works','요양시설 이동약자 12명 대피 필요. 자체 수송수단 없음.','care');
 report(s,'health','의료거점 지원팀 1개 가용. 수용 준비에 5분 필요.','hospital');
 log(s,'훈련 시작 — 가상 지역 호우, 기관별 초기 보고 배포');return s;
}
export function visibleReports(s,role){return s.reports.filter(r=>r.shared||r.role===role);}
export function view(s,role){return {time:s.time,reports:visibleReports(s,role),requests:s.requests.filter(r=>r.from===role||r.owner===role||role==='hq'),resources:s.resources.filter(r=>r.owner===role),decisions:s.log.filter(l=>l.kind==='decision')};}
function step(s){
 s.time++;
 if(s.time===12){s.world.blocked=true;report(s,'police','동측 연결도로 토사 유입으로 단절 확인. 현장 출동팀 우회 필요.','road');log(s,'동측 연결도로 단절. 이동 중인 팀은 우회 경로 적용.');}
 if(s.time===20)report(s,'works','요양시설 주변 수위 상승. 잔류 인원 신속 확인 필요.','care');
 if(s.time%5===0&&!s.world.closed){s.world.trapped+=2;report(s,'fire',`추가 고립 신고. 현재 미구조 인원 ${s.world.trapped}명. 인원 재확인 필요.`,'underpass');log(s,'진입 통제 미완료 → 추가 고립 2명');}
 for(const res of s.resources){
  if(!res.job)continue;const j=res.job,t=TASKS[j.task];
  if(j.phase==='travel'){
   // A single route change adds 5 simulated minutes; road crew has independent access.
   if(s.world.blocked&&!j.detoured&&j.task!=='clear'){j.remaining+=5;j.detoured=true;report(s,res.owner,`${t.name}: 연결도로 단절로 우회, 이동 5분 추가.`,t.place);log(s,`${res.name} 우회 → 이동 5분 추가`);}
   j.remaining--;if(j.remaining<=0){j.phase='work';j.remaining=t.work;report(s,res.owner,`${t.name}: 현장 도착, 작업 시작.`,t.place);}continue;
  }
  j.remaining--;if(j.remaining>0)continue;
  if(j.task==='rescue'){const n=Math.min(6,s.world.trapped);s.world.trapped-=n;s.world.rescued+=n;log(s,`구조·이송팀 작업 완료 → 고립 인원 ${n}명 구조`);}
  if(j.task==='evacuate'){const n=Math.min(6,s.world.evacuees);s.world.evacuees-=n;s.world.evacuated+=n;log(s,`이동약자 ${n}명 안전지점 대피 완료`);}
  if(j.task==='close')s.world.closed=true;
  if(j.task==='clear')s.world.blocked=false;
  if(j.task==='receive')s.world.medicalReady=true;
  const req=s.requests.find(r=>r.id===j.request);req.status='done';req.completed=s.time;
  report(s,res.owner,`${t.name} 완료. ${j.task==='rescue'?'남은 고립 인원 '+s.world.trapped+'명.':j.task==='evacuate'?'남은 대피 대상 '+s.world.evacuees+'명.':''}`,t.place);
  log(s,`${res.name}: ${t.name} 완료, 재배정 가능`);res.job=null;
 }
 if(s.time>=20)s.world.exposure+=s.world.trapped+s.world.evacuees;
 if(s.time>=60){s.ended=true;log(s,'60분 훈련 종료 — 기록을 바탕으로 사후강평 진행');}
}
export function act(state,command){
 const s=clone(state),c=clone(command);if(s.version!==VERSION)throw Error('모델 버전 불일치');
 if(s.ended)throw Error('종료된 훈련입니다. 새 훈련 또는 분기 재훈련을 시작하세요.');
 if(!ROLES[c.role]&&c.role!=='control')throw Error('역할을 확인하세요.');
 if(c.type==='advance'){
  if(c.role!=='control')throw Error('훈련통제 역할에서 시간을 진행하세요.');
  if(!Number.isInteger(c.minutes)||c.minutes<1||c.minutes>10)throw Error('1~10분만 진행 가능합니다.');
  for(let i=0;i<c.minutes&&!s.ended;i++)step(s);
 }else if(c.type==='share'){
  const r=s.reports.find(r=>r.id===c.id);if(!r||r.role!==c.role||r.shared)throw Error('자기 기관의 미공유 보고를 선택하세요.');r.shared=true;log(s,`${ROLES[c.role]} 보고 공유: ${r.text}`,'shared');
 }else if(c.type==='request'){
  const t=TASKS[c.task];if(!t||!ROLES[c.role])throw Error('임무와 기관을 확인하세요.');
  if(!c.reason?.trim())throw Error('판단 근거와 요청 목적을 입력하세요.');
  s.requests.push({id:'Q'+(s.requests.length+1),task:c.task,from:c.role,owner:t.owner,reason:c.reason.trim().slice(0,1000),time:s.time,status:'pending',known:visibleReports(s,c.role).map(r=>r.id)});log(s,`${ROLES[c.role]} → ${ROLES[t.owner]}: ${t.name} 요청 / ${c.reason.trim().slice(0,1000)}`,'decision');
 }else if(c.type==='accept'||c.type==='decline'){
  const r=s.requests.find(r=>r.id===c.id);if(!r||r.owner!==c.role||r.status!=='pending')throw Error('담당 기관의 대기 요청만 처리할 수 있습니다.');
  if(c.type==='decline'){if(!c.reason?.trim())throw Error('지원 불가 사유와 대안을 입력하세요.');r.status='declined';r.reply=c.reason.trim().slice(0,1000);log(s,`${ROLES[c.role]} 지원 불가: ${r.reply}`,'decision');}
  else {const t=TASKS[r.task],res=s.resources.find(x=>x.id===t.resource);if(res.job)throw Error('가용 자원이 없습니다. 현재 임무 완료 후 수락하거나 대안을 회신하세요.');
   if((r.task==='rescue'&&!s.world.trapped)||(r.task==='evacuate'&&!s.world.evacuees)||(r.task==='close'&&s.world.closed)||(r.task==='receive'&&s.world.medicalReady)||(r.task==='clear'&&!s.world.blocked))throw Error('현장 확인 결과 현재 해당 작업 대상이 없습니다.');
   r.status='active';r.accepted=s.time;res.job={request:r.id,task:r.task,phase:t.travel?'travel':'work',remaining:t.travel||t.work,detoured:false};log(s,`${ROLES[c.role]} 수락 → ${res.name} ${t.name} 시작`,'decision');}
 }else if(c.type==='decision'){
  if(!ROLES[c.role]||!c.reason?.trim())throw Error('판단과 협의 내용을 입력하세요.');log(s,`${ROLES[c.role]} 공동 판단: ${c.reason.trim().slice(0,1000)}`,'decision');
 }else if(c.type==='inject'){
  if(c.role!=='control'||!ROLES[c.target]||!c.reason?.trim())throw Error('통제 역할에서 수신 기관과 부여 내용을 입력하세요.');report(s,c.target,`[통제 부여] ${c.reason.trim().slice(0,1000)}`);log(s,`통제 부여 → ${ROLES[c.target]}: ${c.reason.trim().slice(0,1000)}`);
 }else if(c.type==='end'){if(c.role!=='control')throw Error('통제 역할만 종료할 수 있습니다.');s.ended=true;log(s,'통제자 조기 종료');}
 else throw Error('지원하지 않는 행동입니다.');
 s.commands.push({...c,at:state.time});return s;
}
export function replay(mode,commands){let s=create(mode);for(const c of commands)s=act(s,c);return s;}
export function restore(raw){if(raw?.version!==VERSION||!Array.isArray(raw.commands)||raw.commands.length>5000)throw Error('지원하는 훈련 기록이 아닙니다.');return replay(raw.mode,raw.commands);}
export function summary(s){return {minutes:s.time,rescued:s.world.rescued,evacuated:s.world.evacuated,trapped:s.world.trapped,remaining:s.world.evacuees,exposure:s.world.exposure,shared:s.reports.filter(r=>r.shared).length,total:s.reports.length,unresolved:s.requests.filter(r=>r.status==='pending').length,decisions:s.log.filter(l=>l.kind==='decision').length};}
