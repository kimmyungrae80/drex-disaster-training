import fs from 'node:fs';
import path from 'node:path';
import {runExperiment,createGroqCaller,preview,RESEARCH_VERSION} from '../server/research-service.mjs';
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const out=path.resolve(arg('--out','research-runs'));
const live=args.includes('--live'),repetitions=Number(arg('--repetitions','3')),maxRuns=Number(arg('--max-runs','1'));
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>20||!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>180)throw Error('반복수는 1~20, 최대 실행수는 1~180으로 지정하세요.');
if(live&&!process.env.GROQ_API_KEY)throw Error('GROQ_API_KEY가 설정되지 않았습니다. 실험은 실행되지 않았습니다.');
if(fs.existsSync(path.join(out,'plan.json')))throw Error('기존 기록을 덮어쓰지 않습니다. 새로운 --out 폴더를 지정하세요.');
const cases=[];
for(const level of ['beginner','intermediate','advanced'])for(let repetition=1;repetition<=repetitions;repetition++){
 // Balanced cyclic order: preserve the same repetition block for all modes.
 const modes=['plain','text','ontology'];const order=[...modes.slice((repetition-1)%3),...modes.slice(0,(repetition-1)%3)];
 for(const mode of order)cases.push({caseId:`${level}-${repetition}-${mode}`,level,repetition,mode,seed:`pilot-${repetition}`,location:'서울 도심 A구역',repair:false});
}
const plan={researchVersion:RESEARCH_VERSION,createdAt:new Date().toISOString(),knowledgeDigest:preview().knowledgeDigest,requestedModel:process.env.GROQ_MODEL||'openai/gpt-oss-120b',sourceRevision:process.env.DREX_SOURCE_REVISION||null,live,plannedCalls:cases.length,maxRuns:live?maxRuns:0,
  interpretation:'세 난이도의 단일 사례 예비실험입니다. 반복생성을 독립적인 재난사례 표본 수로 해석하지 마세요. 모든 조건은 동일한 내부 검증기를 사용합니다.',cases};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(path.join(out,'expert-review.csv'),'blind_id,reviewer_id,criterion,score,comment\n');
if(!live){console.log('실험계획 작성 완료. AI 호출 없음: '+path.join(out,'plan.json'));}
else{
 const callModel=createGroqCaller({apiKey:process.env.GROQ_API_KEY});
 for(const c of cases.slice(0,maxRuns)){
  const r=await runExperiment(c,{callModel,model:plan.requestedModel});r.caseId=c.caseId;r.repetition=c.repetition;r.sourceRevision=plan.sourceRevision;
  fs.appendFileSync(path.join(out,'results.jsonl'),JSON.stringify(r)+'\n');console.log(c.caseId+': '+r.outcome);
  if(r.outcome==='failed')break;
 }
}
