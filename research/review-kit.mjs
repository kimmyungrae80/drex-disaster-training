import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomInt,randomUUID,createHash} from 'node:crypto';
import {core} from '../ontology/src/research-data.mjs';
const labels=new Map(core['@graph'].map(n=>[n.id,n.label]));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>typeof v==='string'?v:typeof v==='number'?String(v):'미제시';
const label=v=>labels.get(v)||text(v);
const list=v=>Array.isArray(v)?v:[];
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=randomInt(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;};
export const rubric=[['role','기관별 역할 적합성'],['logic','상황 전개의 논리성'],['collaboration','기관 간 협업 판단의 명료성'],['evidence','완료근거와 평가 연결'],['usability','훈련 활용 가능성']];
function displayScenario(p,context){
 const rows=(items,fn)=>list(items).map(x=>fn(x&&typeof x==='object'?x:{})).join('');
 return `<p>${escape(text(p.brief))}</p><p>훈련시간 30분 · 난이도 ${escape(({beginner:'초급',intermediate:'중급',advanced:'고급'})[context.level])}</p><h3>업무</h3>${rows(p.tasks,t=>`<section><h4>${escape(label(t.id))}</h4><p>수행기관: ${escape(label(t.owner))} / 기한: ${escape(text(t.deadlineMinutes))}분</p><p>선행업무: ${escape(list(t.dependsOn).map(label).join(', ')||'미제시')}</p><p>완료근거: ${escape(list(t.evidence).map(text).join(' / ')||'미제시')}</p><p>평가기준: ${escape(list(t.criteria).map(label).join(', ')||'미제시')}</p></section>`)}<h3>상황카드</h3>${rows(p.injects,i=>`<section><h4>${escape(text(i.atMinute))}분 · ${escape(text(i.title))}</h4><p>${escape(text(i.situation))}</p><p>수신기관: ${escape(list(i.visibleTo).map(label).join(', ')||'미제시')}</p><p>기대업무: ${escape(list(i.expectedTasks).map(label).join(', ')||'미제시')}</p><p>판단 대안: ${escape(list(i.decisionOptions).map(text).join(' / ')||'미제시')}</p></section>`)}`;
}
export function analyzeRecords(plan,records){
 if(!Array.isArray(plan.cases)||!plan.cases.length)throw Error('실험계획이 필요합니다.');
 const expected=new Map(plan.cases.map(c=>[c.caseId,c]));
 if(expected.size!==plan.cases.length)throw Error('계획 caseId 중복');
 const byCase=new Map(),runs=new Set();
 for(const r of records){
  if(!expected.has(r.caseId))throw Error('계획에 없는 caseId');
  if(byCase.has(r.caseId)||!r.runId||runs.has(r.runId))throw Error('중복 caseId/runId 또는 runId 누락');
  byCase.set(r.caseId,r);runs.add(r.runId);
 }
 const rows=[],candidates=[];
 for(const c of plan.cases){
  const r=byCase.get(c.caseId),row={caseId:c.caseId,mode:c.mode,level:c.level,repetition:c.repetition,status:'missing'};
  if(!r){rows.push(row);continue;}
  const a=r.attempts?.[0];
  if(r.transport!=='live')row.status='excluded_nonlive';
  else if(r.requestedModel!==plan.requestedModel||(a?.model&&a.model!==plan.requestedModel))row.status='excluded_model';
  else if(r.knowledgeDigest!==plan.knowledgeDigest||!plan.sourceRevision||r.sourceRevision!==plan.sourceRevision)row.status='excluded_provenance';
  else if(['mode','level','seed','location','repair'].some(k=>r.options?.[k]!==c[k]))row.status='excluded_settings';
  else if(r.settings?.temperature!==0.2||r.settings?.max_tokens!==12000||r.settings?.response_format?.type!=='json_object'||(plan.requestedModel.includes('gpt-oss')&&r.settings?.reasoning_effort!=='low'))row.status='excluded_settings';
  else if(!a||a.error||typeof a.raw!=='string'||!a.raw.length||!a.model)row.status='provider_failure';
  else{
   row.status='completed';row.parseSuccess=!!a.parsed&&typeof a.parsed==='object'&&!Array.isArray(a.parsed);
   row.valid=a.validation?.valid===true;row.diagnostics=list(a.validation?.diagnostics).map(x=>x.code);
   row.elapsedMs=a.elapsedMs??null;row.usage=a.usage??null;row.finishReason=a.finishReason??null;
   row.initialValid=row.valid;row.finalOutcome=r.outcome; // Always score the first attempt.
   if(row.parseSuccess)candidates.push({case:c,record:r,parsed:a.parsed,blindId:'S-'+randomUUID().slice(0,8)});
  }
  rows.push(row);
 }
 const groups=['plain','text','ontology'].map(mode=>{
  const a=rows.filter(r=>r.mode===mode),done=a.filter(r=>r.status==='completed');
  return {mode,planned:a.length,recorded:a.filter(r=>r.status!=='missing').length,missing:a.filter(r=>r.status==='missing').length,
   providerFailures:a.filter(r=>r.status==='provider_failure').length,excluded:a.filter(r=>r.status.startsWith('excluded')).length,
   completed:done.length,parsed:done.filter(r=>r.parseSuccess).length,initialValid:done.filter(r=>r.valid).length,
   parseRate:done.length?done.filter(r=>r.parseSuccess).length/done.length:null,
   initialValidRate:done.length?done.filter(r=>r.valid).length/done.length:null};
 });
 const pairedEvidence=[];
 for(const c of plan.cases.filter(c=>c.mode==='text')){
  const b=byCase.get(c.caseId),other=plan.cases.find(x=>x.mode==='ontology'&&x.level===c.level&&x.repetition===c.repetition),o=other&&byCase.get(other.caseId);
  if(b&&o)pairedEvidence.push({level:c.level,repetition:c.repetition,factsMatch:!!b.evidence?.factsSha256&&b.evidence.factsSha256===o.evidence?.factsSha256});
 }
 return {summary:{kind:'initial-output-analysis',generatedAt:new Date().toISOString(),groups,pairedEvidence,
  evidenceComparisonReady:pairedEvidence.length===plan.cases.filter(c=>c.mode==='text').length&&pairedEvidence.every(x=>x.factsMatch),
  hasResults:rows.some(r=>r.status==='completed'),denominator:'parseRate와 initialValidRate의 분모는 completed이며 JSON 파싱 실패를 포함한다. 공급자 실패와 제외 건수는 별도로 보고한다.',
  limitation:'단일 사례의 반복 출력에 대한 기술통계이며 훈련 효과의 근거가 아니다.'},rows,candidates};
}
export function renderReview(candidates,reviewerId){
 const ids=shuffle(candidates),blocks=ids.map(x=>`<article data-id="${escape(x.blindId)}"><h2>${escape(x.blindId)} · ${escape(text(x.parsed.title))}</h2>${displayScenario(x.parsed,x.case)}<h3>독립 평가</h3>${rubric.map(([id,name])=>`<label>${name}<select name="${id}"><option value="">미채점</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}점</option>`).join('')}<option value="NA">판단 불가</option></select></label>`).join('')}<label>수정 소요시간(분, 실제 측정 시에만 입력)<input name="editMinutes" type="number" min="0" step="0.1"></label><label>평가 근거와 수정 의견<textarea name="comment" rows="4"></textarea></label></article>`).join('');
 // Only allowlisted visible fields are passed through; raw prompts, mode, model and validation are absent.
 return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>재난훈련 시나리오 전문가 평가</title><style>body{max-width:920px;margin:32px auto;padding:0 20px;color:#171717;font:16px/1.7 sans-serif}h1,h2,h3{line-height:1.35}article{margin:40px 0;border-top:1px solid #ccc;padding-top:24px}section{margin:20px 0}label{display:block;margin:15px 0}select,input{margin-left:15px;padding:8px;font:inherit}textarea{display:block;width:95%;padding:10px;font:inherit}button{padding:12px 24px;font:inherit}@media print{button{display:none}}</style><h1>재난훈련 시나리오 전문가 평가</h1><p>평가자 ${escape(reviewerId)}. 생성 방법을 추정하지 말고 제시된 내용만 평가하십시오. 기준별 1점은 대폭 수정, 3점은 일부 수정, 5점은 거의 수정 불필요입니다. 판단 근거가 부족하면 ‘판단 불가’를 선택하고 이유를 적으십시오.</p><p>응답은 이 화면에서만 유지됩니다. 페이지를 닫기 전에 아래 버튼으로 평가 결과를 저장하십시오. 다른 평가자와 상의하기 전에 독립 평가를 완료하십시오.</p>${blocks||'<p>평가할 실제 생성 결과가 아직 없습니다. 이 문서는 평가 결과를 포함하지 않습니다.</p>'}<button id="save">평가 결과 저장</button><script>document.getElementById('save').onclick=()=>{const responses=[...document.querySelectorAll('article')].map(a=>({blindId:a.dataset.id,...Object.fromEntries([...a.querySelectorAll('[name]')].map(e=>[e.name,e.value]))}));const data={reviewerId:${JSON.stringify(reviewerId).replace(/</g,'\u003c')},savedAt:new Date().toISOString(),responses};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='expert-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};</script></html>`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
 const planPath=arg('--plan'),recordsPath=arg('--records'),out=path.resolve(arg('--out','research-runs/review-kit'));
 if(!planPath)throw Error('--plan 파일을 지정하세요.');
 if(fs.existsSync(out))throw Error('기존 평가자료를 덮어쓰지 않습니다.');
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
 const raw=recordsPath?fs.readFileSync(recordsPath,'utf8'):'';
 const records=raw.split(/\r?\n/).filter(x=>x.trim()).map(x=>JSON.parse(x));
 const result=analyzeRecords(plan,records);
 result.summary.inputSha256=createHash('sha256').update(raw).digest('hex');
 result.summary.denominator='parseRate와 initialValidRate의 분모는 completed이며 JSON 파싱 실패를 포함한다. 공급자 실패와 제외 건수는 별도로 보고한다.';
 result.summary.limitation='단일 사례의 반복 출력에 대한 기술통계이며 훈련 효과 또는 독립 사례 일반화의 근거가 아니다.';
 fs.mkdirSync(path.join(out,'admin'),{recursive:true});fs.mkdirSync(path.join(out,'reviewers'));
 fs.writeFileSync(path.join(out,'admin','analysis.json'),JSON.stringify({summary:result.summary,rows:result.rows},null,2));
 fs.writeFileSync(path.join(out,'admin','blind-map.json'),JSON.stringify(result.candidates.map(x=>({blindId:x.blindId,caseId:x.case.caseId,runId:x.record.runId,mode:x.case.mode,phase:'initial'})),null,2));
 for(const id of ['R01','R02','R03'])fs.writeFileSync(path.join(out,'reviewers',id+'.html'),renderReview(result.candidates,id));
 console.log(JSON.stringify({reviewableInitialOutputs:result.candidates.length,groups:result.summary.groups},null,2));
}
