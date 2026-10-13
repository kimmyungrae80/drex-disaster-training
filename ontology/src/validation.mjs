// Structural checks only. Content validity still requires independent expert review.
export function validateScenario(scenario, reference = null) {
  const errors = [];
  const fail = (code, path, message) => errors.push({code, path, message});
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(scenario)) return {valid:false, errors:['시나리오 객체가 필요합니다.'], diagnostics:[{code:'SCHEMA',path:'$',message:'시나리오 객체가 필요합니다.'}]};
  const readList = (value, path, allowEmpty = false) => {
    if (!Array.isArray(value) || (!allowEmpty && !value.length)) { fail('SCHEMA',path,'배열 형식과 필수 항목을 확인하세요.'); return []; }
    return value;
  };
  const entities = (key, allowEmpty = false) => {
    const list = readList(scenario[key],key,allowEmpty), map = new Map();
    list.forEach((item,i) => {
      if (!object(item) || typeof item.id !== 'string' || !item.id.trim()) {fail('SCHEMA',`${key}[${i}]`,'항목 ID가 필요합니다.');return;}
      if (map.has(item.id)) fail('DUPLICATE_ID',`${key}[${i}].id`,'중복 ID입니다.');
      map.set(item.id,item);
    }); return map;
  };
  const participants=entities('participants'), supports=entities('supportOrganizations',true);
  const tasks=entities('tasks'), criteria=entities('evaluationCriteria'), injects=entities('injects');
  const orgIds=new Set([...participants.keys(),...supports.keys()]);
  for(const id of participants.keys()) if(supports.has(id)) fail('DUPLICATE_ID',id,'참여기관과 지원기관이 중복됩니다.');
  const duration=scenario.durationMinutes;
  if(!Number.isFinite(duration)||duration<=0)fail('TIME_RANGE','durationMinutes','훈련시간은 양수여야 합니다.');
  const known = reference ? new Map(reference['@graph'].map(n=>[n.id,n])) : null;
  const knownType=(id,type,path)=>{if(known&&known.get(id)?.type!==type)fail('UNKNOWN_ENTITY',path,`등록되지 않은 ${type}: ${id}`);};
  for(const id of orgIds)knownType(id,'Organization',id);
  for(const id of criteria.keys())knownType(id,'EvaluationCriterion',id);
  const dependencies=new Map();
  for(const [id,t]of tasks){
    knownType(id,'Task',id);
    if(!orgIds.has(t.owner))fail('UNKNOWN_OWNER',id+'.owner','참여·지원기관에 없는 수행기관입니다.');
    const deps=readList(t.dependsOn,id+'.dependsOn',true);
    dependencies.set(id,deps.filter(x=>typeof x==='string'));
    const referenceTask=known?.get(id);
    if(referenceTask?.type==='Task'){
      if(t.owner!==referenceTask.ownedBy)fail('REFERENCE_OWNER',id+'.owner','내부 지식에 정의된 수행기관과 다릅니다.');
      const expected=referenceTask.dependsOn||[];
      if(expected.length!==deps.length||expected.some(d=>!deps.includes(d)))fail('REFERENCE_DEPENDENCY',id+'.dependsOn','내부 지식의 선행관계와 다릅니다.');
    }
    for(const dep of deps){
      if(dep===id)fail('SELF_DEPENDENCY',id+'.dependsOn','자기 자신을 선행업무로 지정할 수 없습니다.');
      if(!tasks.has(dep))fail('UNKNOWN_DEPENDENCY',id+'.dependsOn',`없는 선행업무: ${dep}`);
    }
    const evidence=readList(t.evidence,id+'.evidence');
    if(evidence.some(e=>typeof e!=='string'||!e.trim()))fail('SCHEMA',id+'.evidence','완료근거는 비어 있지 않은 문자열이어야 합니다.');
    const taskCriteria=readList(t.criteria,id+'.criteria');
    for(const c of taskCriteria)if(!criteria.has(c))fail('UNKNOWN_CRITERION',id+'.criteria',`없는 평가기준: ${c}`);
    if(referenceTask?.type==='Task'){
      const expected=referenceTask.satisfiesCriterion||[];
      if(expected.length!==taskCriteria.length||expected.some(c=>!taskCriteria.includes(c)))fail('REFERENCE_CRITERION',id+'.criteria','내부 지식의 평가기준 연결과 다릅니다.');
    }
    if(!Number.isFinite(t.deadlineMinutes)||t.deadlineMinutes<0||t.deadlineMinutes>duration)fail('TIME_RANGE',id+'.deadlineMinutes','업무기한이 훈련시간 범위를 벗어났습니다.');
  }
  const colors=new Map();
  function visit(id){
    if(colors.get(id)===1){fail('DEPENDENCY_CYCLE',id,'선행업무가 순환합니다.');return;}
    if(colors.get(id)===2)return;
    colors.set(id,1);for(const dep of dependencies.get(id)||[])if(tasks.has(dep))visit(dep);colors.set(id,2);
  }
  for(const id of tasks.keys())visit(id);
  let previous=-Infinity;
  for(const [id,i]of injects){
    knownType(i.eventId,'HazardEvent',id+'.eventId');
    for(const org of readList(i.visibleTo,id+'.visibleTo'))if(!orgIds.has(org))fail('UNKNOWN_RECIPIENT',id+'.visibleTo',`없는 수신기관: ${org}`);
    for(const task of readList(i.expectedTasks,id+'.expectedTasks',true))if(!tasks.has(task))fail('UNKNOWN_TASK',id+'.expectedTasks',`없는 업무: ${task}`);
    const choices=readList(i.decisionOptions,id+'.decisionOptions');
    if(choices.length<2||choices.some(c=>typeof c!=='string'||!c.trim())||new Set(choices).size!==choices.length)fail('DECISION_OPTIONS',id+'.decisionOptions','서로 다른 판단 대안 두 개 이상이 필요합니다.');
    if(!Number.isFinite(i.atMinute)||i.atMinute<0||i.atMinute>duration)fail('TIME_RANGE',id+'.atMinute','상황 부여시각이 훈련시간 범위를 벗어났습니다.');
    if(i.atMinute<previous)fail('TIME_ORDER',id+'.atMinute','상황카드의 시간 순서가 역전됐습니다.');previous=i.atMinute;
    if(typeof i.situation!=='string'||!i.situation.trim())fail('SCHEMA',id+'.situation','상황 설명이 필요합니다.');
  }
  for(const id of participants.keys())if(![...tasks.values()].some(t=>t.owner===id))fail('UNASSIGNED_PARTICIPANT',id,'참여기관에 배정된 업무가 없습니다.');
  for(const id of criteria.keys())if(![...tasks.values()].some(t=>Array.isArray(t.criteria)&&t.criteria.includes(id)))fail('UNSUPPORTED_CRITERION',id,'평가기준에 연결된 업무·완료근거가 없습니다.');
  return {valid:!errors.length, errors:errors.map(e=>`${e.path}: ${e.message}`), diagnostics:errors};
}
