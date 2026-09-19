export const AGENCIES=['지자체','소방','경찰','보건','시설관리','군','교육','환경','도로관리','전력','통신','가스','자원봉사'];
export const TASKS=[
 {id:'broadcast',name:'상황 전파',agency:'지자체',minutes:1,deps:[]},
 {id:'control',name:'지하차도 진입 통제',agency:'경찰',minutes:3,deps:['broadcast']},
 {id:'power',name:'전력 차단·안전 확인',agency:'시설관리',minutes:4,deps:['broadcast']},
 {id:'rescue',name:'고립자 구조',agency:'소방',minutes:5,deps:['control','power']},
 {id:'medical',name:'부상자 인계·이송',agency:'보건',minutes:4,deps:['rescue']},
 {id:'shelter',name:'대피소 개방·수용 확인',agency:'지자체',minutes:3,deps:['broadcast']}
];
export const DEFAULT_CHECKLIST=TASKS.map((t,i)=>({id:'C'+(i+1),title:t.name+' 이행 확인',task:t.id,weight:[15,20,15,20,15,15][i],deadline:[3,8,9,16,22,12][i],criterion:'요청·접수·완료 기록과 완료 근거를 확인합니다. 기한 내 완료 시 충족, 지연 또는 진행 중은 부분 충족.',partial:.5}));
export function newSession(){return {version:1,id:globalThis.crypto.randomUUID(),title:'가상 지하차도 침수 대응훈련',org:'훈련기관',minute:0,status:'setup',help:true,checklist:structuredClone(DEFAULT_CHECKLIST),checklistSource:'기본 샘플 · 공식 평가기준 아님',events:[],tasks:{},reviews:{},improvements:{},notes:'',map:null,revision:0};}
export function log(s,type,data={}){const e={id:'E'+String(s.events.length+1).padStart(3,'0'),at:s.minute,type,...data};s.events.push(e);s.revision++;return e;}
export function start(s){if(s.status!=='setup')throw Error('이미 시작한 훈련입니다.');s.status='running';log(s,'start',{text:s.title+' 시작'});}
export function advance(s,n=1){if(s.status!=='running')throw Error('진행 중인 훈련에서만 시간을 넘길 수 있습니다.');if(!Number.isInteger(n)||n<1||n>10)throw Error('1~10분 단위로 진행하세요.');s.minute+=n;log(s,'clock',{text:n+'분 경과'});}
export function act(s,taskId,kind,actor,text='',assisted=false){
 if(s.status!=='running')throw Error('훈련을 시작한 후 조치하세요.');const t=TASKS.find(x=>x.id===taskId);if(!t)throw Error('알 수 없는 조치입니다.');
 if(!AGENCIES.includes(actor))throw Error('기관을 선택하세요.');const state=s.tasks[taskId];
 if(!['request','ack','complete'].includes(kind))throw Error('잘못된 조치입니다.');
 if(kind==='request'&&state)throw Error('이미 요청된 조치입니다.');
 if(kind==='ack'&&(!state||state.status!=='requested'))throw Error('요청을 먼저 등록하세요.');
 if(kind==='complete'&&(!state||state.status!=='accepted'))throw Error('담당 기관이 먼저 접수해야 합니다.');
 if(kind!=='request'&&actor!==t.agency)throw Error(t.agency+' 역할에서 접수·완료하세요.');
 if(kind==='complete'){
  const missing=t.deps.filter(id=>s.tasks[id]?.status!=='completed');if(missing.length)throw Error('선행 조치 필요: '+missing.map(id=>TASKS.find(x=>x.id===id).name).join(', '));
  if(s.minute-state.acceptedAt<t.minutes)throw Error('접수 후 훈련시간 '+t.minutes+'분이 필요합니다.');
  if(!text.trim())throw Error('완료 근거를 입력하세요.');
 }
 const event=log(s,kind,{task:taskId,agency:actor,target:t.agency,text:text.trim().slice(0,2000),assisted});
 if(kind==='request')s.tasks[taskId]={status:'requested',requestedAt:s.minute,ids:[event.id]};
 else {state.ids.push(event.id);state.status=kind==='ack'?'accepted':'completed';state[kind==='ack'?'acceptedAt':'completedAt']=s.minute;}
 return event;
}
export function evidence(s,agency,text){if(!AGENCIES.includes(agency))throw Error('기관을 선택하세요.');if(s.status==='setup')throw Error('훈련 시작 후 기록하세요.');if(!text.trim())throw Error('보완 근거를 입력하세요.');log(s,'note',{agency,text:text.trim().slice(0,4000),source:'실무자 보완 입력'});}
export function evaluate(s){return s.checklist.map(c=>{
 const task=s.tasks[c.task];let verdict='확인 필요',reason='시스템 기록만으로 이행 여부를 확인할 수 없습니다.';
 if(task?.status==='completed'){verdict=task.completedAt<=c.deadline?'충족':'부분 충족';reason=verdict==='충족'?'설정 기한 내 완료 기록과 근거가 있습니다.':'완료 기록은 있으나 설정 기한을 초과했습니다.';}
 else if(task){verdict='부분 충족';reason='요청 또는 접수 기록이 있으나 완료 확인이 필요합니다.';}
 const review=s.reviews[c.id];if(review){verdict=review.verdict;reason='실무자 검토: '+review.reason;}
 const points=verdict==='충족'?c.weight:verdict==='부분 충족'?Math.round(c.weight*c.partial*100)/100:verdict==='미충족'?0:null;
 return {...c,verdict,reason,points,evidence:[...new Set([...(task?.ids||[]),...(review?.evidence||[])])],reviewed:!!review,assisted:(task?.ids||[]).some(id=>s.events.find(e=>e.id===id)?.assisted)};
 });}
export function review(s,id,verdict,reason,ids=[]){if(s.status==='setup')throw Error('훈련 시작 후 검토하세요.');if(!s.checklist.some(c=>c.id===id))throw Error('항목을 찾을 수 없습니다.');if(!['충족','부분 충족','미충족','확인 필요','해당 없음'].includes(verdict))throw Error('판정을 선택하세요.');if(!reason.trim())throw Error('검토 사유가 필요합니다.');if(ids.some(id=>!s.events.some(e=>e.id===id)))throw Error('존재하지 않는 근거 번호입니다.');if(['충족','부분 충족','미충족'].includes(verdict)&&!ids.length)throw Error('판정 근거 기록 번호를 하나 이상 연결하세요.');s.reviews[id]={verdict,reason:reason.trim(),evidence:ids};log(s,'review',{text:id+' '+verdict+' · '+reason});}
export function validateChecklist(input){
 const rows=Array.isArray(input)?input:input.items;if(!Array.isArray(rows)||!rows.length||rows.length>50)throw Error('점검 항목은 1~50개여야 합니다.');const ids=new Set();
 return rows.map((r,i)=>{const id=String(r.id||'C'+(i+1));if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('항목 번호는 영문·숫자·밑줄·하이픈 1~40자로 입력하세요.');if(ids.has(id))throw Error('중복 항목 번호: '+id);ids.add(id);
 const weight=Number(r.weight),deadline=Number(r.deadline),partial=Number(r.partial??.5);
 if(!r.title||!r.criterion||!Number.isFinite(weight)||weight<0||weight>100||!Number.isFinite(deadline)||deadline<0||!Number.isFinite(partial)||partial<0||partial>1)throw Error('항목명·기준·배점·기한·부분충족 비율을 확인하세요.');
 if(r.task&&!TASKS.some(t=>t.id===r.task))throw Error('지원되지 않는 연결 조치: '+r.task);
 return {id:id.slice(0,40),title:String(r.title).slice(0,200),criterion:String(r.criterion).slice(0,2000),task:r.task||'',weight,deadline,partial};});
}
export function summary(s){const rows=evaluate(s),scored=rows.filter(r=>r.points!==null),unresolved=rows.filter(r=>r.verdict==='확인 필요').length;return {rows,earned:scored.reduce((a,r)=>a+r.points,0),assessedMax:scored.reduce((a,r)=>a+r.weight,0),applicableMax:rows.filter(r=>r.verdict!=='해당 없음').reduce((a,r)=>a+r.weight,0),unresolved};}
export function sample(){const s=newSession();s.title='[가상 샘플] 침수 대응 · 정상·지연·미확인 비교';start(s);
 for(const id of ['broadcast','control','power','shelter'])act(s,id,'request','지자체','샘플 협조 요청');
 act(s,'broadcast','ack','지자체');advance(s,1);act(s,'broadcast','complete','지자체','관계 기관 상황 전파 확인');
 act(s,'control','ack','경찰');act(s,'power','ack','시설관리');advance(s,4);
 act(s,'control','complete','경찰','양방향 진입 통제 확인');act(s,'power','complete','시설관리','전력 차단과 안전 확인 기록');
 act(s,'rescue','request','지자체','고립자 구조 요청');act(s,'rescue','ack','소방');advance(s,10);advance(s,3);act(s,'rescue','complete','소방','가상 고립자 구조 완료 — 기한보다 지연');
 evidence(s,'지자체','대피소 요청은 전달했으나 담당자의 접수 확인 기록이 없음. 이송 여부는 별도 확인 필요.');s.status='ended';log(s,'end',{text:'가상 샘플 종료'});return s;}
const EVENT_LABELS={request:'협조 요청',ack:'접수',complete:'완료',note:'근거 보완',clock:'시간 진행',start:'시작',end:'종료',review:'검토',help:'도움말',join:'기관 참여',improve:'개선과제',notes:'종합 의견'};
export function report(s){const q=summary(s);return [
 '# DREX 훈련 결과보고서 초안', '자동 작성 초안 · 실무자 검토 후 확정 / '+s.checklistSource,
 '## 1. 훈련 개요',`훈련명: ${s.title}\n기관: ${s.org}\n훈련시간: ${s.minute}분 (수동 진행 훈련시계)\n상태: ${s.status==='ended'?'종료':'진행 중 — 중간보고'}\n모드: 기관 행동 중심 실무훈련 · 단독 역할 전환 / 기관별 공동 접속`,
 '## 2. 점검 결과',`확인된 항목 점수: ${q.earned} / ${q.assessedMax}점\n적용 대상 배점: ${q.applicableMax}점 · 확인 필요 ${q.unresolved}건\n확인 필요는 0점 처리하지 않으며 위 점수는 최종 총점이 아닙니다.`,
 ...q.rows.map(r=>`### ${r.id}. ${r.title}\n판정: ${r.verdict} / 점수: ${r.points??'미확정'} / 배점: ${r.weight}\n기준: ${r.criterion}\n기한: ${r.deadline}분 · 부분 충족 배점 비율: ${r.partial}\n근거: ${r.evidence.join(', ')||'추가 확인 필요'}\n검토: ${r.reason}\n도움말 사용: ${r.assisted?'있음':'기록 없음'}`),
 '## 3. 기관별 주요 조치',...AGENCIES.map(a=>{const ev=s.events.filter(e=>e.agency===a);return ev.length?`${a}\n${ev.map(e=>`${e.id} [${e.at}분] ${EVENT_LABELS[e.type]||e.type} ${TASKS.find(t=>t.id===e.task)?.name||''} ${e.text||''}`).join('\n')}`:''}).filter(Boolean),
 '## 4. 개선과제',...q.rows.filter(r=>r.verdict!=='충족'&&r.verdict!=='해당 없음').map(r=>{const p=s.improvements[r.id]||{};return `${r.id} ${r.title}: ${r.reason}\n개선계획: ${p.action||'실무자 작성 필요'}\n담당: ${p.owner||'미정'} / 기한: ${p.due||'미정'}`;}),
 '## 5. 실무자 종합 의견',s.notes||'작성 필요',
 '## 6. 전체 기록',...s.events.map(e=>`${e.id} | ${e.at}분 | ${EVENT_LABELS[e.type]||e.type} | ${e.agency||'훈련운영'} | ${TASKS.find(t=>t.id===e.task)?.name||''} | ${e.text||''}`),
 '## 7. 작성 기준과 한계','재난 상황·작업시간·점검기한은 시범훈련용 가정이며 공식 기준 또는 실제 예측값이 아닙니다. 자유서술과 외부 수행은 실무자의 근거 보완·검토가 필요합니다. 지도상의 배치는 작업시간 계산과 연결되지 않습니다. AI 의견은 별도 제안이며 점검 판정을 자동 변경하지 않습니다.'
 ].join('\n\n');}
export function reportHTML(s){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const body=report(s).split('\n\n').map(block=>{const lines=block.split('\n');const head=lines[0].match(/^(#{1,3}) (.*)$/);if(head){const tag='h'+head[1].length;return `<${tag}>${esc(head[2])}</${tag}>`+(lines.length>1?'<p>'+lines.slice(1).map(esc).join('<br>')+'</p>':'');}return '<p>'+lines.map(esc).join('<br>')+'</p>';}).join('\n');
 return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DREX 훈련 결과보고서 초안</title><style>body{max-width:900px;margin:35px auto;padding:25px;font:15px/1.85 system-ui,sans-serif;color:#21364a;background:#fff}h1{font-size:29px;border-bottom:4px solid #126b70;padding-bottom:18px}h2{margin-top:38px;font-size:21px;color:#125e65;border-bottom:1px solid #d2dfe6;padding-bottom:10px}h3{font-size:17px;margin-top:25px}p{overflow-wrap:anywhere}h1,h2,h3{break-after:avoid}@media print{body{margin:0;padding:0;font-size:10.5pt}@page{size:A4;margin:20mm}}</style><body>'+body+'</body></html>';
}
export function restoreSession(raw){
 if(!raw||raw.version!==1||!['setup','running','ended'].includes(raw.status)||!Number.isInteger(raw.minute)||raw.minute<0||raw.minute>100000)throw Error('백업 상태·시간 형식 오류');
 const s=newSession();s.id=typeof raw.id==='string'&&/^[0-9a-f-]{36}$/.test(raw.id)?raw.id:s.id;s.status=raw.status;s.minute=raw.minute;s.title=String(raw.title||s.title).slice(0,150);s.org=String(raw.org||'훈련기관').slice(0,100);s.help=Boolean(raw.help);s.checklist=validateChecklist(raw.checklist);s.checklistSource=String(raw.checklistSource||'백업 점검표').slice(0,200);
 if(!Array.isArray(raw.events)||raw.events.length>3000)throw Error('백업 기록 형식 오류');const ids=new Set();s.events=raw.events.map(e=>{if(!e||typeof e.id!=='string'||!/^E\d+$/.test(e.id)||ids.has(e.id)||!Number.isFinite(e.at)||e.at<0||e.at>s.minute||typeof e.type!=='string')throw Error('백업 기록 번호·시간 오류');ids.add(e.id);return {id:e.id,at:e.at,type:e.type.slice(0,30),agency:AGENCIES.includes(e.agency)?e.agency:undefined,task:TASKS.some(t=>t.id===e.task)?e.task:undefined,text:String(e.text||'').slice(0,8000),assisted:!!e.assisted};});
 if(s.events.some((e,i)=>e.id!=='E'+String(i+1).padStart(3,'0')))throw Error('백업 기록 순서 오류');
 for(const t of TASKS){const v=raw.tasks?.[t.id];if(!v)continue;if(!['requested','accepted','completed'].includes(v.status)||!Array.isArray(v.ids)||v.ids.some(id=>!ids.has(id)))throw Error('백업 조치 연결 오류');const clean={status:v.status,ids:v.ids};for(const k of ['requestedAt','acceptedAt','completedAt']){if(v[k]!==undefined){if(!Number.isFinite(v[k])||v[k]<0||v[k]>s.minute)throw Error('백업 조치 시각 오류');clean[k]=v[k];}}if(clean.requestedAt===undefined||(v.status!=='requested'&&clean.acceptedAt===undefined)||(v.status==='completed'&&clean.completedAt===undefined))throw Error('필수 조치 시각 누락');s.tasks[t.id]=clean;}
 for(const c of s.checklist){const r=raw.reviews?.[c.id];if(r){if(!['충족','부분 충족','미충족','확인 필요','해당 없음'].includes(r.verdict)||!Array.isArray(r.evidence)||r.evidence.some(id=>!ids.has(id))||!r.reason)throw Error('검토 근거 오류');s.reviews[c.id]={verdict:r.verdict,reason:String(r.reason).slice(0,2000),evidence:r.evidence};}const p=raw.improvements?.[c.id];if(p)s.improvements[c.id]={action:String(p.action||'').slice(0,2000),owner:String(p.owner||'').slice(0,200),due:String(p.due||'').slice(0,30)};}
 s.notes=String(raw.notes||'').slice(0,8000);s.map=raw.map&&JSON.stringify(raw.map).length<250000?raw.map:null;s.revision=s.events.length;return s;
}
