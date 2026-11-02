import {VERSION,configOf,makeExercise,projected,participantCommand,controllerCommand,advance,evaluation,record,text,fail,clone} from '../exercise/engine.mjs';
const secret=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function makeExerciseHandler(store,{now=()=>Date.now(),generate=null}={}){
  const view=(row,member)=>({id:row.id,revision:row.revision,expiresAt:row.expires_at,...projected(row.payload.exercise,member,Object.values(row.payload.members)),...(member.kind==='control'?{invites:row.payload.invites}:{})});
  async function create(input,baseline=null,identity=null){
    const c=configOf(input.config),s=makeExercise(c,now()),token=identity?.token||secret();
    const member={kind:c.scope==='solo'?'participant':'control',org:c.scope==='solo'?c.ownOrg:null,name:text(input.name||'훈련 운영자',80)};
    if(c.scope==='solo'){s.status='running';record(s,'started','control','개인 연습 시작',{},['all']);}
    if(baseline){s.baseline=baseline;s.improvements=baseline.improvements.map(i=>({...i,status:'retest',previousStatus:i.status,sourceExercise:baseline.id}));}
    const row={id:identity?.id||crypto.randomUUID(),revision:0,expires_at:new Date(now()+7*86400000).toISOString(),payload:{kind:VERSION,exercise:s,members:{[await digest(token)]:member},invites:Object.fromEntries(c.orgs.map(o=>[o.id,secret()])),receipts:[]}};
    await store.insert(row);return {...view(row,member),token};
  }
  return async request=>{
    const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    try{
      if(request.method!=='POST')fail('POST 요청을 사용하세요.',405);
      const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)fail('허용되지 않은 출처입니다.',403);
      const raw=await request.text();if(raw.length>60000)fail('요청이 너무 큽니다.',413);const b=JSON.parse(raw);
      if(b.op==='health'){await store.health();return send({ready:true,ai:!!generate,version:VERSION});}
      if(b.op==='prepare'){
        const c=configOf(b.config);const standard=`${c.location}의 가상 시설에서 집중호우에 따른 고립 신고가 접수됐습니다. 기관별 정보의 출처와 확인 상태를 살피고, 현장 지원과 대피 준비를 조정하세요. 실제 발생한 재난이나 실제 시설에 대한 정보가 아닙니다.`;
        let brief=standard,source='template',notice='검토 가능한 교육용 기본 시나리오를 구성했습니다.';
        if(b.useAI===true){if(!generate)notice='AI 연결이 설정되지 않았습니다. 기본 시나리오이며 AI 생성 결과가 아닙니다.';else try{const result=await generate({location:c.location,objectives:c.objectives.map(o=>({title:o.title,target:o.target})),orgs:c.orgs.map(o=>o.name),standard});brief=text(result.brief,2000);source='ai';notice='AI가 초기 브리핑 초안을 작성했습니다. 확인 후 개설하세요. 숨겨진 사실·상황 변화·평가기준은 AI가 변경하지 않습니다.';}catch{notice='AI 응답을 사용할 수 없어 기본 시나리오로 전환했습니다. AI 생성 결과가 아닙니다.';}}
        return send({config:c,brief,source,notice,assumptions:{type:'교육용 가정',facility:'가상 시설',participants:'기관별 초기 정보 상이',durations:'현장 확인 2분 / 진입로 3분 / 전기 안전 4분 / 대피시설 3분 / 안내 2분 / 현장 지원 5분',rules:'현장 지원은 진입로·전기 안전·대피시설 준비를 확인한 뒤 진행. 이 조건은 본 샘플의 가정이며 법정 절차를 대체하지 않음.'}});
      }
      if(b.op==='create')return send(await create(b));
      if(typeof b.id!=='string'||!/^[0-9a-f-]{36}$/.test(b.id))fail('훈련방 주소를 확인하세요.');
      const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'',hash=await digest(token);
      for(let attempt=0;attempt<8;attempt++){
        const saved=await store.get(b.id);if(!saved||Date.parse(saved.expires_at)<now()||saved.payload.kind!==VERSION)fail('훈련방이 없거나 보관기간(7일)이 지났습니다.',404);
        const row=clone(saved),p=row.payload,s=p.exercise;
        if(b.op==='join'){
          if(s.config.scope==='solo'||!p.invites[b.org]||p.invites[b.org]!==b.invite)fail('기관 초대 링크를 확인하세요.',403);
          if(s.config.scope==='agency'&&b.org!==s.config.ownOrg)fail('한 기관 훈련에는 지정된 기관만 입장할 수 있습니다.',403);
          if(s.status!=='lobby')fail('기관 구성은 훈련 시작 전에 확정합니다. 기존 접속정보로 복원하세요.',409);
          if(Object.values(p.members).filter(m=>m.org===b.org).length>=10)fail('기관별 참가자 한도(10명)입니다.');
          const credential=secret(),member={kind:'participant',org:b.org,name:text(b.name,80)};p.members[await digest(credential)]=member;
          if(!await store.update(row.id,row.revision,p))continue;row.revision++;return send({...view(row,member),token:credential});
        }
        const member=p.members[hash];if(!member)fail('접속정보가 필요합니다. 입장했던 브라우저에서 복원하세요.',401);
        if(b.op==='retrain'){
          if(member.kind!=='control'||s.status!=='ended')fail('운영자가 종료된 훈련에서 재훈련을 개설할 수 있습니다.',403);
          // Reserve one stable identity with CAS before creating the linked room.
          // Concurrent retries and interrupted creation resume the same room.
          if(!p.retraining){const report=evaluation(s);p.retraining={id:crypto.randomUUID(),token:secret(),name:member.name,config:{...s.config,variant:'detour'},baseline:{id:row.id,metrics:report.metrics,criteria:report.criteria.map(c=>({id:c.id,title:c.title,status:c.status})),improvements:clone(s.improvements)}};if(!await store.update(row.id,row.revision,p))continue;}
          const reserved=p.retraining,existing=await store.get(reserved.id);
          if(existing)return send({...view(existing,member),token:reserved.token,reused:true});
          try{return send(await create(reserved,reserved.baseline,reserved));}catch(error){const concurrent=await store.get(reserved.id);if(concurrent)return send({...view(concurrent,member),token:reserved.token,reused:true});throw error;}
        }
        if(!['read','command'].includes(b.op))fail('지원하지 않는 요청입니다.');
        const humans=new Set(Object.values(p.members).filter(m=>m.kind==='participant').map(m=>m.org));
        const bots=s.config.simulateOthers?s.config.orgs.filter(o=>!humans.has(o.id)).map(o=>o.id):[];
        let changed=advance(s,bots,now());
        if(b.op==='command'){
          if(typeof b.requestId!=='string'||!/^[a-zA-Z0-9-]{10,100}$/.test(b.requestId))fail('요청 식별자가 필요합니다.');
          const receipt=hash+':'+b.requestId;
          if(!p.receipts.includes(receipt)){
            if(s.events.length>6000)fail('훈련 기록 한도입니다.');const c=b.command;if(!c||typeof c.type!=='string')fail('조치를 확인하세요.');
            const control=member.kind==='control',solo=s.config.scope==='solo';
            if(['start','pause','resume','advance','end'].includes(c.type)){
              if(!control&&!solo)fail('운영자만 시간을 통제할 수 있습니다.',403);
              if(c.type==='start'){
                if(s.status!=='lobby')fail('대기 중인 훈련만 시작할 수 있습니다.');
                if(!humans.size)fail('기관 참가자가 입장한 후 시작하세요.');
                if(!s.config.simulateOthers&&s.config.orgs.some(o=>!humans.has(o.id)))fail('선택한 기관이 모두 입장해야 합니다. 미참여 기관 모의는 개설 단계에서 설정하세요.');
                s.status='running';s.lastTick=now();record(s,'started','control','훈련 시작',{},['all']);
              }else if(c.type==='advance'){
                if(s.status!=='running'||!Number.isInteger(c.minutes)||c.minutes<1||c.minutes>5)fail('진행 중인 훈련에서 1~5분씩 진행하세요.');advance(s,bots,now(),c.minutes);
              }else if(c.type==='end'){
                if(!['running','paused'].includes(s.status))fail('진행 중인 훈련만 종료할 수 있습니다.');s.status='ended';record(s,'ended','control','훈련 종료',{},['all']);
              }else{
                if(s.status!==(c.type==='pause'?'running':'paused'))fail('현재 상태에서 변경할 수 없습니다.');s.status=c.type==='pause'?'paused':'running';s.lastTick=now();record(s,c.type,'control',c.type==='pause'?'훈련 일시정지':'훈련 재개',{},['all']);
              }
            }else if(control)controllerCommand(s,c);
            else participantCommand(s,member.org,c);
            p.receipts.push(receipt);if(p.receipts.length>6000)fail('훈련 요청 한도입니다.');changed=true;
          }
        }
        if(changed){if(!await store.update(row.id,row.revision,p))continue;row.revision++;}
        return send(view(row,member));
      }
      fail('동시 요청이 많습니다. 잠시 후 같은 요청을 다시 보내세요.',409);
    }catch(e){return send({error:e.status?e.message:e instanceof SyntaxError?'요청 형식이 올바르지 않습니다.':'훈련 서버 처리 중 오류가 발생했습니다.',retryable:e.status===409},e.status||500);}
  };
}
