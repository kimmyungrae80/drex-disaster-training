import {VERSION,ROLES,PLACES,TASKS,GUIDES,create,act,view,visibleReports,restore,replay,summary} from './engine.mjs';
import {SITES,setupMap} from './map.mjs';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='drex-cpx-0.1';let state=create(),role='hq',tab='board',archives=[];let storageOK=true;let selectedSite='underpass',mapUI;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),5000);}
function save(){try{localStorage.setItem(KEY,JSON.stringify({state,archives}));}catch{storageOK=false;toast('자동 저장이 불가능합니다. 기록 저장 버튼으로 파일을 내려받으세요.');}}
function archive(){if(state.commands.length){archives.push({label:`${state.mode==='practice'?'연습':'실제'} ${state.time}분 · ${new Date().toLocaleString('ko-KR')}`,data:{version:VERSION,mode:state.mode,commands:state.commands}});}}
function send(c){try{state=act(state,{role,...c});save();render();return true;}catch(e){toast(e.message);return false;}}
function download(name,content,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const statusText={pending:'수락 대기',active:'실행 중',done:'완료',declined:'지원 불가'};
function render(){
 const v=view(state,role),control=role==='control';
 $('clock').textContent=String(state.time).padStart(2,'0')+':00';$('runState').textContent=state.ended?'훈련 종료':'통제자 수동 진행 · 분:초';$('modeBadge').textContent=state.mode==='practice'?'연습훈련 · 안내 지원':'실제훈련 · 독립 판단';
 $('board').hidden=tab!=='board';$('aar').hidden=tab!=='aar';$('boardTab').classList.toggle('active',tab==='board');$('aarTab').classList.toggle('active',tab==='aar');
 $('guide').hidden=state.mode!=='practice';$('board').classList.toggle('withGuide',state.mode==='practice');
 $('guideContent').innerHTML=`<h3>${control?'훈련통제':ROLES[role]}의 연습 포인트</h3><ol>${(GUIDES[role]||['기관별 보고 공유와 지원 요청 진행을 확인하세요.','시간을 1분 또는 5분씩 진행하고 결과 보고가 도착하는 것을 확인하세요.','훈련 종료 후 기록에서 의사결정과 현장 결과를 연결해 보세요.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`;
 $('reportCount').textContent=v.reports.length+'건';
 $('reports').innerHTML=v.reports.length?v.reports.slice().reverse().map(r=>`<article class="report"><div class="meta">${r.id} · ${r.time}분 · ${ROLES[r.role]} ${r.shared?'<span class="shared">· 공동 전파</span>':'· 기관 수신'}</div><p>${esc(r.text)}</p>${r.role===role&&!r.shared?`<button data-share="${r.id}" ${state.ended?'disabled':''}>공동 전파</button>`:''}</article>`).join(''):'<p class="empty">아직 공유된 보고가 없습니다. 기관별 역할에서 보고를 확인하세요.</p>';
 renderCoach();
 renderOperational(v);
 $('resources').innerHTML=v.resources.map(r=>`<div class="resource"><strong>${r.name}</strong><div class="bar ${r.job?'active':''}"></div><small>${r.job?`${TASKS[r.job.task].name} · ${r.job.phase==='travel'?'이동':'작업'} ${r.job.remaining}분 남음`:'가용 · 새 임무 수락 가능'}</small></div>`).join('')||'<p class="empty">기관 역할을 선택해 가용 자원을 확인하세요.</p>';
 $('pendingCount').textContent=v.requests.filter(r=>r.status==='pending').length+'건 대기';
 $('requests').innerHTML=v.requests.slice().reverse().map(r=>`<article class="request"><div class="meta">${r.id} · ${r.time}분 · ${ROLES[r.from]} → ${ROLES[r.owner]}</div><strong>${TASKS[r.task].name}</strong><p>${esc(r.reason)}</p><span class="chip">${statusText[r.status]}</span>${r.reply?`<p>회신: ${esc(r.reply)}</p>`:''}${r.status==='pending'&&r.owner===role&&!state.ended?`<div class="actions"><button class="primary" data-accept="${r.id}">임무 수락</button><button data-decline="${r.id}">조정 회신</button></div>`:''}</article>`).join('')||'<p class="empty">접수된 임무 요청이 없습니다.</p>';
 $('control').hidden=!control;$('orderForm').hidden=control;$('truth').textContent=`통제자 모의 상태: 고립 ${state.world.trapped}명 / 대피 잔류 ${state.world.evacuees}명 / 진입 ${state.world.closed?'통제':'미통제'} / 도로 ${state.world.blocked?'단절':'통행 가능'}`;
 document.querySelectorAll('#control button,#orderForm button').forEach(b=>b.disabled=state.ended);
 if(tab==='board')mapUI?.resize();
 renderAAR();
}


function setRole(next){role=next;$('role').value=role;render();}
function renderCoach(){
 const box=$('nextAction');box.hidden=state.mode!=='practice'||tab!=='board';if(box.hidden)return;
 let step=1,title='',text='',evidence='',label='',fn;const first=state.requests.find(r=>r.status!=='declined')||state.requests[0];
 const report=state.reports.find(r=>r.id==='R2');
 if(state.ended){step=5;title='훈련이 끝났습니다. 판단과 결과를 돌아보세요.';text='사후강평에서 어떤 정보를 바탕으로 결정했는지 확인할 수 있습니다.';label='사후강평 열기';fn=()=>{tab='aar';render();};}
 else if(!report.shared){title='소방의 고립 신고를 확인하고 공유하세요.';text='첫 연습은 상황보고를 읽는 것부터 시작합니다. 한 기기에서 기관 역할을 바꾸며 진행합니다.';evidence='연습용 안내: '+report.text;label=role==='fire'?'이 보고를 다른 기관에 공유':'소방 역할로 이동해 보고 확인';fn=()=>role==='fire'?send({type:'share',id:'R2'}):setRole('fire');}
 else if(!first){step=2;title='어떤 지원이 필요한지 요청하세요.';text='상황총괄 역할에서 오른쪽 ‘대응조치’의 임무를 선택하고 이유를 적은 뒤 ‘지원 요청 보내기’를 누르세요.';evidence='예: 고립 인원 구조를 먼저 요청하고, 대피 차량 배정은 소방과 협의합니다.';label=role==='hq'?'요청 작성란으로 이동':'상황총괄 역할로 이동';fn=()=>{if(role!=='hq')setRole('hq');$('reason').focus();$('orderForm').scrollIntoView({block:'center',behavior:'smooth'});};}
 else if(first.status==='pending'){step=3;title=ROLES[first.owner]+'에서 요청을 검토하고 수락하세요.';text='요청을 보낸 것만으로 출동하지 않습니다. 담당 기관이 자원을 확인하고 수락해야 실행됩니다.';evidence='받은 요청: '+TASKS[first.task].name+' / '+first.reason;label=role===first.owner?'요청 수락하고 출동':'담당 '+ROLES[first.owner]+' 역할로 이동';fn=()=>role===first.owner?send({type:'accept',id:first.id}):setRole(first.owner);}
 else if(first.status==='active'){step=4;const res=state.resources.find(r=>r.job?.request===first.id);title='출동했습니다. 시간을 진행해 결과를 확인하세요.';text='이 검증판의 시간은 자동으로 흐르지 않습니다. 아래 버튼을 누르면 통제 역할로 전환해 훈련시간을 5분 진행합니다.';evidence=res?res.name+' · '+(res.job.phase==='travel'?'현장 이동 중':'현장 작업 중')+' · 현재 단계 '+res.job.remaining+'분 남음':'';label='훈련시간 5분 진행';fn=()=>{setRole('control');send({type:'advance',minutes:5});};}
 else if(first.status==='done'){step=5;const result=state.reports.find(r=>r.role===first.owner&&r.time===first.completed&&r.text.startsWith(TASKS[first.task].name+' 완료'));title=result?.shared?'결과를 확인하고 다음 판단을 내려보세요.':'완료 보고를 확인하고 다른 기관에 공유하세요.';text=result?.shared?'첫 협업 과정을 마쳤습니다. 다른 임무를 요청하며 계속 연습하거나 훈련을 종료해 강평을 확인하세요.':'현장 작업이 끝나도 보고가 공유되지 않으면 다른 기관은 결과를 모릅니다.';evidence=result?.text||'결과 보고를 확인하세요.';label=result?.shared?'훈련 종료하고 강평 보기':role===first.owner?'완료 보고 공유':ROLES[first.owner]+' 역할로 결과 확인';fn=()=>{if(result?.shared){if(confirm('현재 훈련을 종료하고 강평을 확인할까요?')){setRole('control');send({type:'end'});tab='aar';render();}}else if(role!==first.owner)setRole(first.owner);else if(result)send({type:'share',id:result.id});};}
 else{step=2;title='지원 불가 사유를 읽고 대안을 요청하세요.';text='다른 임무를 선택하거나 기관과 우선순위를 조정할 수 있습니다.';evidence=first.reply||'';label='새 요청 작성';fn=()=>{setRole('hq');$('reason').focus();};}
 $('coachProgress').textContent='연습 '+step+' / 5';$('coachTitle').textContent=title;$('coachText').textContent=text;$('coachEvidence').textContent=evidence;$('coachNext').textContent=label;$('coachNext').onclick=fn;
 $('coachExample').hidden=step!==2||role!=='hq';$('coachExample').onclick=()=>{$('reason').value='고립 신고 인원의 구조·이송을 요청합니다. 요양시설 대피와 자원 중복을 확인해 가능한 출동 시점을 회신해 주세요.';$('reason').focus();toast('예시를 넣었습니다. 내용을 검토한 뒤 지원 요청을 보내세요.');};
 document.querySelectorAll('.coachSteps li').forEach((li,i)=>{li.classList.toggle('current',i+1===step);li.classList.toggle('complete',i+1<step);});
}

function chooseSite(id){selectedSite=id;$('task').value=SITES[id].task;mapUI?.focus(id);render();}
function renderOperational(v){
 $('knownMetric').textContent=v.reports.length+'건';$('sharedMetric').textContent=v.reports.filter(r=>r.shared).length+'건';$('requestMetric').textContent=v.requests.filter(r=>r.status==='pending').length+'건';$('activeMetric').textContent=v.requests.filter(r=>r.status==='active').length+'건';
 $('incidentList').innerHTML=Object.entries(SITES).map(([id,p])=>{const r=v.reports.filter(x=>x.place===id).at(-1);return `<button class="incidentButton ${id===selectedSite?'active':''}" data-site="${id}"><span class="incidentLetter" style="--incident:${p.color}">${p.label}</span><span><strong>${p.name}</strong><small>${r?r.time+'분 보고 · '+ROLES[r.role]:'정보 확인 필요'}</small></span><span class="incidentArrow">›</span></button>`;}).join('');
 const site=SITES[selectedSite],last=v.reports.filter(r=>r.place===selectedSite).at(-1);
 $('incidentDetail').innerHTML=`<div class="detailTop"><div><span class="detailCaption">${site.type} · 훈련 가정 위치</span><h3>${site.name}</h3></div><button id="selectMission">관련 임무 선택</button></div><p>${last?esc(last.text):'현재 기관에 확인된 보고가 없습니다. 관계기관에 정보를 요청하고 공동 전파된 상황을 확인하세요.'}</p><span class="detailCaption">${last?'출처 '+ROLES[last.role]+' · 보고 시각 '+last.time+'분':'지점은 시나리오에 지정된 가정 위치입니다.'}</span>`;
 $('selectMission').onclick=()=>{$('task').value=site.task;if(role==='control'){toast('기관 역할을 선택한 뒤 대응조치를 요청하세요.');return;}$('reason').focus();};
 $('agencyStrip').innerHTML=Object.entries(ROLES).map(([id,name])=>{const qs=v.requests.filter(r=>r.owner===id),active=qs.filter(r=>r.status==='active').length,waiting=qs.filter(r=>r.status==='pending').length;return `<div><strong>${name}</strong><small>${active?'수행 '+active+'건':waiting?'협조 대기 '+waiting+'건':qs.some(r=>r.status==='done')?'완료 보고 있음':'확인된 임무 없음'}</small></div>`;}).join('');
 mapUI?.render(v,selectedSite,TASKS);
}

function reviewHTML(){const m=summary(state);return `<div class="reviewBox"><strong>규칙 기반 강평 초안 · AI 평가 미연결</strong><ul><li>공유된 보고 ${m.shared}/${m.total}건. 핵심 정보가 판단 전에 전달됐는지 아래 시각을 비교하세요.</li><li>미처리 지원 요청 ${m.unresolved}건. 담당 기관의 자원 제약과 회신 여부를 확인하세요.</li><li>구조 ${m.rescued}명, 안전지점 대피 ${m.evacuated}명. 의료 수용 준비 ${state.world.medicalReady?'완료':'미완료'}. 의료 인계·치료 결과는 이 모델에서 계산하지 않습니다.</li><li>20분 이후 잔류 노출 누적 ${m.exposure}인·분. 교육용 비교 지표이며 사상자 수가 아닙니다.</li></ul><p><strong>강평 질문</strong> 당시 어떤 정보를 알고 있었습니까? 구조와 대피의 우선순위를 어떻게 합의했습니까? 다시 한다면 어떤 보고나 결정을 먼저 하겠습니까?</p><p>개선과제 작성: 담당 기관 / 개선 행동 / 완료 기한 / 다음 훈련에서 확인할 증거</p></div>`;}
function renderAAR(){
 const reveal=state.ended||role==='control',m=summary(state);
 $('aarNotice').textContent=reveal?'전체 모의 상태와 당시 보고를 함께 검토합니다. 자동 점수·합격 판정은 하지 않습니다.':'훈련 중에는 공동 판단·공유 기록만 표시합니다. 전체 결과는 종료 후 공개됩니다.';
 $('metrics').innerHTML=reveal?[[m.rescued+'명','구조 완료'],[m.evacuated+'명','안전지점 대피'],[m.shared+'건','공동 전파 보고'],[m.unresolved+'건','미처리 요청']].map(([n,l])=>`<div class="metric"><strong>${n}</strong><span>${l}</span></div>`).join(''):'';
 $('review').innerHTML=reveal?reviewHTML():'';
 const logs=reveal?state.log:state.log.filter(l=>['decision','shared'].includes(l.kind));
 $('timeline').innerHTML=logs.map(l=>`<div class="timelineRow"><time>${l.time}분</time><div>${esc(l.text)}</div></div>`).join('');
 if(reveal)$('timeline').innerHTML+=state.requests.map(r=>`<details><summary>${r.id} ${TASKS[r.task].name} · 요청 당시 근거 보고 ${r.known.length}건</summary>${r.known.map(id=>{const x=state.reports.find(z=>z.id===id);return `<p>${id} · ${x.time}분 · ${esc(x.text)}</p>`;}).join('')}</details>`).join('');
 $('branchPoint').innerHTML=state.commands.map((c,i)=>`<option value="${i}">${c.at}분 · ${i+1}번째 행동 직전 · ${ROLES[c.role]||'훈련통제'} · ${esc(({request:'임무 요청',accept:'수락',decline:'지원 불가',share:'보고 공유',advance:'시간 진행',decision:'판단 기록',inject:'상황 부여',end:'종료'})[c.type])}</option>`).join('');
 $('fork').disabled=!reveal||!state.commands.length;$('reportDownload').disabled=!reveal;
 $('archives').innerHTML=archives.map((a,i)=>`<button data-archive="${i}">${esc(a.label)} · 기록 내려받기</button>`).join('')||'보관한 실행 없음';
}
function reportDocument(){const m=summary(state);return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>DREX 사후강평</title><style>body{max-width:900px;margin:40px auto;padding:20px;font:16px/1.8 system-ui;color:#183046}td,th{border:1px solid #ccd8dd;padding:8px}table{border-collapse:collapse;width:100%}h1{color:#136e78}</style><h1>DREX 지휘소훈련 사후강평</h1><p>${VERSION} · ${state.mode==='practice'?'연습훈련':'실제훈련'} · ${state.time}분 ${state.ended?'종료':'중간 기록'}</p><p>가상 지역 호우. 규칙 기반 초안이며 공식 평가 또는 실제 피해 예측이 아닙니다.</p>${reviewHTML()}<h2>결정·현장 변화 기록</h2><table><tr><th>훈련 시각</th><th>기록</th></tr>${state.log.map(l=>`<tr><td>${l.time}분</td><td>${esc(l.text)}</td></tr>`).join('')}</table><h2>요청 시점에 알고 있던 정보</h2>${state.requests.map(r=>`<h3>${r.id} · ${TASKS[r.task].name}</h3><p>${esc(r.reason)}</p><ul>${r.known.map(id=>`<li>${id}: ${esc(state.reports.find(x=>x.id===id).text)}</li>`).join('')}</ul>`).join('')}<h2>실무자 검토·개선계획</h2><table><tr><th>개선사항</th><th>담당 기관</th><th>기한</th><th>재훈련 확인 방법</th></tr><tr><td>검토 후 작성</td><td></td><td></td><td></td></tr></table><p>모델 가정: 구조·대피 1회 최대 6명, 공유 이송팀 1대. 12분 도로 단절, 우회 5분. 통제 전 5분마다 고립 2명 추가. 완료 후 자원 즉시 재배정 가정. 복귀 이동·정밀 수리계산·사상자 예측 미구현.</p></html>`;}
const roleOptions=Object.entries(ROLES).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');$('role').innerHTML=roleOptions+'<option value="control">훈련통제</option>';$('target').innerHTML=roleOptions;
 $('task').innerHTML=Object.entries(TASKS).map(([id,t])=>`<option value="${id}">${t.name} → ${ROLES[t.owner]}</option>`).join('');
 $('roleHelp').innerHTML='<p>상황총괄: 정보 종합·우선순위 협의 / 소방: 구조·이송 / 경찰: 통제·도로 보고 / 보건: 의료 수용 준비 / 시설·대피지원: 대피 수요·도로 정비</p>';
 $('role').onchange=()=>{role=$('role').value;render();};$('boardTab').onclick=()=>{tab='board';render();};$('aarTab').onclick=()=>{tab='aar';render();};$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
 $('new').onclick=()=>$('setup').showModal();$('start').onclick=e=>{e.preventDefault();archive();state=create(document.querySelector('[name="mode"]:checked').value);role='hq';$('role').value=role;tab='board';save();render();$('setup').close();};
 $('orderForm').onsubmit=e=>{e.preventDefault();if(send({type:'request',task:$('task').value,reason:$('reason').value})){$('reason').value='';toast('요청했습니다. 담당 기관 역할에서 임무 수락을 진행하세요.');}};
 $('decision').onclick=()=>{if(send({type:'decision',reason:$('reason').value}))$('reason').value='';};
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.site)chooseSite(b.dataset.site);if(b.dataset.share)send({type:'share',id:b.dataset.share});if(b.dataset.accept)send({type:'accept',id:b.dataset.accept});if(b.dataset.decline){const reason=prompt('지원 불가 사유와 대안을 입력하세요.');if(reason)send({type:'decline',id:b.dataset.decline,reason});}if(b.dataset.minutes)send({type:'advance',minutes:Number(b.dataset.minutes)});if(b.dataset.archive!==undefined){const a=archives[Number(b.dataset.archive)];download('DREX_CPX_archive.json',JSON.stringify(a.data,null,2));}});
 $('inject').onclick=()=>{if(send({type:'inject',target:$('target').value,reason:$('injectText').value}))$('injectText').value='';};$('end').onclick=()=>{if(confirm('현재 시점에서 종료하고 사후강평을 진행할까요?')){send({type:'end'});tab='aar';render();}};
 $('export').onclick=()=>download('DREX_CPX_record.json',JSON.stringify({version:VERSION,mode:state.mode,commands:state.commands},null,2));
 $('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>3000000)throw Error('3MB 이하 기록만 불러올 수 있습니다.');const loaded=restore(JSON.parse(await f.text()));archive();state=loaded;save();render();toast('기록을 재실행해 복원했습니다.');}catch(err){toast('불러오기 실패: '+err.message);}e.target.value='';};
 $('fork').onclick=()=>{const n=Number($('branchPoint').value);if(confirm('현재 실행을 보관하고 선택 지점 직전부터 다시 훈련할까요?')){const next=replay(state.mode,state.commands.slice(0,n));archive();state=next;tab='board';save();render();toast('분기 재훈련을 시작했습니다. 이전 기록은 사후강평에서 내려받을 수 있습니다.');}};
 $('reportDownload').onclick=()=>download('DREX_CPX_AAR.html',reportDocument(),'text/html');
 mapUI=setupMap({select:chooseSite,notify:toast});
 try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);state=restore(parsed.state);archives=Array.isArray(parsed.archives)?parsed.archives:[];}else $('setup').showModal();}catch{storageOK=false;$('setup').showModal();toast('저장 기록을 읽지 못했습니다. 새 훈련으로 시작합니다.');}
 render();
