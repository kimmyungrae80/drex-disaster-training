// Finite software checks on an unchanged validator; not live LLM observations.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {generateScenario,validateScenario} from '../ontology/src/scenario-generator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=s=>createHash('sha256').update(s).digest('hex');
const args=process.argv.slice(2),value=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const out=path.resolve(value('--out','research-runs/extended-verification.json'));
if(fs.existsSync(out)||fs.existsSync(out+'.plan.json'))throw Error('기존 검증 파일을 덮어쓰지 않습니다.');
const seed=JSON.parse(fs.readFileSync(path.join(root,'ontology/data/seoul-urban-flood.seed.json'),'utf8'));
const faults=[
 ['self_dependency','SELF_DEPENDENCY',s=>s.tasks[0].dependsOn=[s.tasks[0].id]],
 ['dependency_cycle','DEPENDENCY_CYCLE',s=>{s.tasks[0].dependsOn=[s.tasks[1].id];s.tasks[1].dependsOn=[s.tasks[0].id];}],
 ['unknown_criterion','UNKNOWN_CRITERION',s=>s.tasks[0].criteria=['dtx:missing']],
 ['unknown_recipient','UNKNOWN_RECIPIENT',s=>s.injects[0].visibleTo=['dtx:missing']],
 ['time_out_of_range','TIME_RANGE',s=>s.injects.at(-1).atMinute=s.durationMinutes+1],
 ['time_reversed','TIME_ORDER',s=>s.injects[1].atMinute=0],
 ['duplicate_task','DUPLICATE_ID',s=>s.tasks.push(structuredClone(s.tasks[0]))],
 ['wrong_known_owner','REFERENCE_OWNER',s=>{const a=s.tasks[0],b=s.tasks.find(t=>t.owner!==a.owner);[a.owner,b.owner]=[b.owner,a.owner];}],
 ['missing_dependency','REFERENCE_DEPENDENCY',s=>s.tasks.find(t=>t.dependsOn.length).dependsOn=[]],
 ['missing_evidence','SCHEMA',s=>s.tasks[0].evidence=[]],
 ['unknown_dependency','UNKNOWN_DEPENDENCY',s=>s.tasks[0].dependsOn=['dtx:missing']],
 ['unknown_expected_task','UNKNOWN_TASK',s=>s.injects[0].expectedTasks=['dtx:missing']]
];
const invariantChanges=[
 ['task_array_order',s=>s.tasks.reverse()],
 ['relation_set_order',s=>{for(const t of s.tasks){t.dependsOn.reverse();t.criteria.reverse();}}]
];
// Deliberate scope probes. Acceptance is reported, not scored as a success.
const probes=[
 ['contradictory_situation','동일 시각·장소의 정전과 정상 공급을 동시에 단정',s=>s.injects[0].situation='같은 시각 같은 지하공간의 전력 공급이 완전히 중단되었다. 같은 시각 같은 지하공간의 전력 공급은 중단 없이 정상이다.'],
 ['non_evidence_text','완료근거 필드에 근거가 없다는 문장을 입력',s=>s.tasks[0].evidence=['완료를 확인할 기록이나 증거는 없다.']],
 ['empty_expected_tasks','모든 상황카드의 기대업무를 빈 목록으로 변경',s=>{for(const i of s.injects)i.expectedTasks=[];}]
];
const plan={kind:'finite-software-verification-plan',createdAt:new Date().toISOString(),sourceRevision:process.env.DREX_SOURCE_REVISION||null,
 levels:['beginner','intermediate','advanced'],durations:[10,30,180],seeds:[0,'audit-ko-01','audit-ko-02'],
 faultDefinitions:faults.map(([id,expectedCode,fn])=>({id,expectedCode,mutation:fn.toString()})),
 invariants:invariantChanges.map(([id,fn])=>({id,mutation:fn.toString()})),
 probes:probes.map(([id,label,fn])=>({id,label,mutation:fn.toString()})),
 note:'계획 파일은 검증 호출 전에 저장한다. 내부 실행계획이며 공개 사전등록이나 독립 평가집합이 아니다.'};
fs.mkdirSync(path.dirname(out),{recursive:true});
const planText=JSON.stringify(plan,null,2)+'\n';fs.writeFileSync(out+'.plan.json',planText);
const check=s=>{try{const r=validateScenario(s);return {valid:r.valid,codes:[...new Set(r.diagnostics.map(d=>d.code))],errors:r.errors,exception:null};}catch(e){return {valid:null,codes:[],exception:String(e.message)};}};
const controls=[],mutations=[],invariants=[],scopeProbes=[];
for(const level of plan.levels)for(const duration of plan.durations)for(const randomSeed of plan.seeds){
 const options={level,randomSeed,seedData:{...seed,durationMinutes:duration}};
 const s=generateScenario(options),again=generateScenario(options),id=`${level}/${duration}/${randomSeed}`;
 const firstHash=sha(JSON.stringify(s));
 controls.push({id,level,duration,randomSeed,scenarioSha256:firstHash,repeatEqual:firstHash===sha(JSON.stringify(again)),...check(s)});
 for(const[faultId,expectedCode,mutate]of faults){const copy=structuredClone(s);mutate(copy);const r=check(copy);mutations.push({id,faultId,expectedCode,...r,detectedExpectedCode:r.valid===false&&r.codes.includes(expectedCode)});}
 for(const[changeId,mutate]of invariantChanges){const copy=structuredClone(s);mutate(copy);invariants.push({id,changeId,...check(copy)});}
}
for(const level of plan.levels)for(const[probeId,label,mutate]of probes){const s=generateScenario({level,randomSeed:'scope-probe-01'});mutate(s);scopeProbes.push({level,probeId,label,...check(s)});}
const sourceFiles=['ontology/src/validation.mjs','ontology/src/scenario-core.mjs','ontology/data/core-knowledge.v0.1.jsonld','ontology/data/seoul-urban-flood.seed.json','research/verify-extended.mjs'];
const result={kind:'extended-controlled-software-verification',createdAt:new Date().toISOString(),node:process.version,sourceRevision:plan.sourceRevision,
 planSha256:sha(planText),sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),
 summary:{controls:controls.length,controlsAccepted:controls.filter(x=>x.valid).length,repeatedEqual:controls.filter(x=>x.repeatEqual).length,
 faults:mutations.length,faultsDetected:mutations.filter(x=>x.detectedExpectedCode).length,invariants:invariants.length,invariantsAccepted:invariants.filter(x=>x.valid).length,
 scopeProbes:scopeProbes.length,scopeProbesAccepted:scopeProbes.filter(x=>x.valid).length,exceptions:[...controls,...mutations,...invariants,...scopeProbes].filter(x=>x.exception).length},
 controls,mutations,invariants,scopeProbes,
 limitations:['동일 도시 침수 사례의 설정 조합이며 독립 재난사례 표본이 아니다.','12개 결함 유형을 반복 적용했으므로 324개 독립 오류 유형이 아니다.','범위 탐색 사례의 통과는 내용 타당성을 보증하지 못하는 한계를 드러낸다.','실제 AI 응답 또는 전문가 점수가 아니다.']};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary,null,2));
if(result.summary.controlsAccepted!==controls.length||result.summary.faultsDetected!==mutations.length||result.summary.invariantsAccepted!==invariants.length||result.summary.repeatedEqual!==controls.length||result.summary.exceptions)process.exitCode=1;
