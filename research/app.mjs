const $=id=>document.getElementById(id),storageKey='drex_research_v02';
let current=null,busy=false,history=[];
try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(data))history=data.filter(r=>r?.runId&&Array.isArray(r.attempts)).slice(-10);}catch{}
const options=()=>({mode:$('mode').value,level:$('level').value,location:$('location').value,seed:$('seed').value,repair:$('repair').checked});
const text=(tag,value,cls='')=>{const el=document.createElement(tag);el.textContent=value;el.className=cls;return el;};
function saveFile(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(record){
 current=record;$('summary').replaceChildren();$('errors').replaceChildren();$('cards').replaceChildren();
 const isPreview=record.kind==='preview',attempts=record.attempts||[],last=attempts.at(-1),scenario=isPreview?record.scenario:record.final;
 const labels={valid:'구조 검사 통과',invalid:'검토 필요',failed:'생성 실패'};
 $('summary').append(text('span',isPreview?'규칙 기반 골격 · AI 미호출':labels[record.outcome]||'기록','badge '+(record.outcome&&record.outcome!=='valid'?'bad':'')));
 if(!isPreview){
  $('summary').append(text('p',`요청 모델: ${record.requestedModel}\n실제 응답 모델: ${attempts.map(a=>a.model||'응답 없음').join(' → ')}\n실험 ID: ${record.runId}`,'meta'));
  if(!record.eligibleForModelComparison)$('summary').append(text('p','모델 정보 불일치·호출 실패·시험 응답 여부를 확인한 뒤 비교 표본에 포함하세요.','hint'));
 }
 if(last?.validation?.errors?.length){const ul=document.createElement('ul');last.validation.errors.forEach(e=>ul.append(text('li',e)));$('errors').append(ul);}
 if(last?.error)$('errors').append(text('p',last.error.code+' · '+last.error.message));
 if(scenario){
  $('cards').append(text('h3',scenario.title||'시나리오'));
  if(scenario.brief)$('cards').append(text('p',scenario.brief));
  for(const i of (Array.isArray(scenario.injects)?scenario.injects:[])){
   if(!i||typeof i!=='object')continue;
   const card=text('article','','card');card.append(text('h3',`${i.atMinute??'?'}분 · ${i.title||i.eventId||i.id}`),text('p',i.situation||''));
   card.append(text('p','수신: '+(Array.isArray(i.visibleTo)?i.visibleTo.join(', '):'형식 확인 필요'),'meta'));
   $('cards').append(card);
  }
 }
 $('rawPanel').hidden=false;$('raw').textContent=JSON.stringify(record,null,2);$('download').disabled=false;
}
function renderHistory(){
 $('history').replaceChildren();
 if(!history.length){$('history').append(text('li','저장된 실험 기록이 없습니다.','hint'));return;}
 for(const r of [...history].reverse()){const li=document.createElement('li'),b=text('button',`${new Date(r.createdAt).toLocaleString('ko-KR')} · ${r.options.mode} · ${r.options.level} · ${r.outcome}`);b.addEventListener('click',()=>render(r));li.append(b);$('history').append(li);}
}
async function readResponse(response){
 if(!response.ok){let body;try{body=await response.json();}catch{}throw Error(body?.error||`서버 응답 오류 (${response.status})`);}
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return response.json();
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',record;
 while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;
  while((end=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const dataLine=block.split('\n').find(l=>l.startsWith('data: '));if(!dataLine)continue;const data=JSON.parse(dataLine.slice(6));
   if(block.startsWith('event: record'))record=data;else if(block.startsWith('event: error'))throw Error(data.error);else if(data.message)$('status').textContent=data.message;
  }
 }
 if(!record)throw Error('최종 실험 기록을 받지 못했습니다. 새 성공 표본은 저장되지 않았습니다.');return record;
}
async function request(op){
 if(busy||!$('controls').reportValidity())return;busy=true;$('generate').disabled=$('preview').disabled=true;
 current=null;$('download').disabled=true;$('rawPanel').hidden=true;
 for(const id of ['summary','errors','cards'])$(id).replaceChildren();
 $('status').textContent=op==='preview'?'규칙 기반 골격을 구성합니다.':'AI 생성과 검증을 진행합니다.';
 try{
  const response=await fetch('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,options:options()}),signal:AbortSignal.timeout(125000)});
  const data=await readResponse(response);
  if(op==='preview'){render({...data,kind:'preview'});$('status').textContent='골격을 확인했습니다. 이 결과는 AI 비교실험 표본에 포함되지 않습니다.';}
  else{
   history=[...history,data].slice(-10);let saved=true;try{localStorage.setItem(storageKey,JSON.stringify(history));}catch{saved=false;}
   render(data);renderHistory();$('status').textContent=saved?'실험 기록을 보관했습니다. 원문과 오류·보정 결과를 JSON으로 내려받으세요.':'브라우저 보관 용량이 부족합니다. 현재 기록을 JSON으로 내려받으세요.';
  }
 }catch(e){$('status').textContent='요청 실패: '+e.message;}
 finally{busy=false;$('generate').disabled=$('preview').disabled=false;}
}
$('controls').addEventListener('submit',e=>{e.preventDefault();request('generate');});
$('preview').addEventListener('click',()=>request('preview'));
$('download').addEventListener('click',()=>current&&saveFile(`drex-${current.runId||'skeleton'}.json`,JSON.stringify(current,null,2)));
$('exportAll').addEventListener('click',()=>{if(!history.length){$('status').textContent='내려받을 실험 기록이 없습니다.';return;}saveFile('drex-research-runs.jsonl',history.map(r=>JSON.stringify(r)).join('\n')+'\n','application/x-ndjson');});
renderHistory();
