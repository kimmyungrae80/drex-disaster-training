// Controlled software fault injection. These are not LLM quality samples.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {generateScenario,validateScenario} from '../ontology/src/scenario-generator.mjs';
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const baselinePath=arg('--baseline'),output=arg('--out');
const baseline=baselinePath?await import(pathToFileURL(path.resolve(baselinePath))):null;
const cases=[
 ['self_dependency','자기 선행업무',s=>s.tasks[0].dependsOn=[s.tasks[0].id]],
 ['dependency_cycle','두 업무 순환',s=>{s.tasks[0].dependsOn=[s.tasks[1].id];s.tasks[1].dependsOn=[s.tasks[0].id];}],
 ['unknown_criterion','없는 평가기준',s=>s.tasks[0].criteria=['dtx:missing']],
 ['unknown_recipient','없는 수신기관',s=>s.injects[0].visibleTo=['dtx:missing']],
 ['time_out_of_range','훈련시간 초과',s=>s.injects.at(-1).atMinute=s.durationMinutes+1],
 ['time_reversed','상황 시간 역전',s=>s.injects[1].atMinute=0],
 ['duplicate_task','중복 업무 ID',s=>s.tasks.push(structuredClone(s.tasks[0]))],
 ['wrong_known_owner','등록기관 간 업무배정 변경',s=>{const a=s.tasks[0],b=s.tasks.find(t=>t.owner!==a.owner);[a.owner,b.owner]=[b.owner,a.owner];}],
 ['missing_dependency','필수 선행업무 삭제',s=>s.tasks.find(t=>t.dependsOn.length).dependsOn=[]],
 ['missing_evidence','완료근거 삭제',s=>s.tasks[0].evidence=[]],
 ['unknown_dependency','없는 선행업무',s=>s.tasks[0].dependsOn=['dtx:missing']],
 ['unknown_expected_task','없는 기대업무',s=>s.injects[0].expectedTasks=['dtx:missing']]
];
const seed='verification-fixed-01';
// Identical input for both validators, regenerated from the original engine when supplied.
const base=(baseline||{generateScenario}).generateScenario({level:'intermediate',randomSeed:seed});
const check=(fn,s)=>{try{const r=fn(s);return {detected:!r.valid,valid:r.valid,errors:r.errors,threw:false};}catch(e){return {detected:false,valid:null,threw:true,error:String(e.message)};}};
const rows=cases.map(([id,label,mutate])=>{const s=structuredClone(base);mutate(s);return {id,label,...(baseline?{baseline:check(baseline.validateScenario,s)}:{}),revised:check(validateScenario,s)};});
const controls=['beginner','intermediate','advanced'].map(level=>{const s=(baseline||{generateScenario}).generateScenario({level,randomSeed:seed});return {level,injects:s.injects.length,tasks:s.tasks.length,criteria:s.evaluationCriteria.length,...(baseline?{baseline:check(baseline.validateScenario,s)}:{}),revised:check(validateScenario,s)};});
const result={kind:'controlled-software-verification',createdAt:new Date().toISOString(),node:process.version,seed,baselineSourceSha256:baselinePath?createHash('sha256').update(fs.readFileSync(baselinePath)).digest('hex'):null,baseScenarioSha256:createHash('sha256').update(JSON.stringify(base)).digest('hex'),faults:rows.length,baselineDetected:baseline?rows.filter(r=>r.baseline.detected).length:null,revisedDetected:rows.filter(r=>r.revised.detected).length,controls,rows,limitation:'검사 규칙에 맞춰 구성한 제한된 결함 주입 집합이다. 실제 AI 오류 분포, 일반화 탐지율, 전문가 내용 타당성, 학습 효과를 측정하지 않는다.'};
const text=JSON.stringify(result,null,2)+'\n';if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,text);}else process.stdout.write(text);
if(rows.some(r=>!r.revised.detected)||controls.some(r=>!r.revised.valid))process.exitCode=1;
