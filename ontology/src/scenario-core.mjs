import {validateScenario as validateStructure} from './validation.mjs';

export function createScenarioEngine(core, defaultSeed) {
const nodes = new Map(core['@graph'].map(node => [node.id, node]));

const levelRank = { beginner: 1, intermediate: 2, advanced: 3 };
const phaseByIndex = ['초기대응', '확산·대응', '확산·대응', '공동대응', '수습·안정화', '수습·안정화'];

function hashSeed(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function label(id) {
  return nodes.get(id)?.label || id.replace('dtx:', '');
}

function organizationBrief(orgId, selectedEvents, tasks) {
  const org = nodes.get(orgId);
  const visibleEvents = selectedEvents.filter(id => (nodes.get(id)?.visibleTo || []).includes(orgId));
  const ownedTasks = tasks.filter(task => task.ownedBy === orgId);
  return {
    organizationId: orgId,
    organization: org.label,
    mission: (org.hasCapability || []).map(label),
    privateInformation: visibleEvents.map(id => ({eventId:id, label:label(id)})),
    assignedTasks: ownedTasks.map(task => ({
      taskId: task.id,
      task: task.label,
      dependsOn: (task.dependsOn || []).map(id => ({taskId:id, task:label(id)})),
      deadlineMinutes: task.delayThresholdMinutes,
      evidence: task.producesEvidence || []
    }))
  };
}

function eventNarrative(eventId, location) {
  const narratives = {
    'dtx:undergroundInflow': `${location} 지하공간으로 빗물이 유입되고 있으나 유입량과 고립인원은 기관별로 다르게 파악되고 있다.`,
    'dtx:pumpFailure': '배수펌프 일부가 기능저하 상태를 보이면서 침수속도가 빨라질 가능성이 있다.',
    'dtx:powerFailure': '지하상가와 역사 일부에서 정전이 발생하고 감전·화재 위험 여부가 확인되지 않았다.',
    'dtx:metroSuspension': '역사 안전확인을 위해 열차 운행조정이 필요하고 지상으로 이동하는 시민이 늘고 있다.',
    'dtx:crowdConcentration': '폐쇄된 출입구 주변과 광장에 인파가 집중되어 대피동선과 구조동선이 충돌하고 있다.',
    'dtx:roadCongestion': '도심 교통정체로 구조차량 진입이 지연되고 우회동선 확보가 필요하다.',
    'dtx:vulnerablePersonTrapped': '이동지원이 필요한 시민이 지하공간에 남아 있다는 신고가 접수됐으나 정확한 위치는 확인되지 않았다.',
    'dtx:informationDisorder': '온라인에서 확인되지 않은 시설 붕괴설이 확산되며 시민 이동이 한쪽 출구로 몰리고 있다.',
    'dtx:emergencyLightingFailure': '비상조명이 간헐적으로 꺼지며 대피 유도와 고립자 위치 확인이 어려워지고 있다.'
  };
  return narratives[eventId] || `${label(eventId)} 상황이 발생했다.`;
}

function expectedTaskIds(eventId) {
  const map = {
    'dtx:undergroundInflow':['dtx:situationShare','dtx:passengerCount'],
    'dtx:pumpFailure':['dtx:situationShare','dtx:stationEvacuation'],
    'dtx:powerFailure':['dtx:powerIsolation'],
    'dtx:metroSuspension':['dtx:passengerCount','dtx:stationEvacuation'],
    'dtx:crowdConcentration':['dtx:accessControl','dtx:publicMessage'],
    'dtx:roadCongestion':['dtx:rescueRoute'],
    'dtx:vulnerablePersonTrapped':['dtx:trappedPersonRescue'],
    'dtx:informationDisorder':['dtx:publicMessage'],
    'dtx:emergencyLightingFailure':['dtx:powerIsolation','dtx:stationEvacuation']
  };
  return map[eventId] || [];
}

function decisionFor(eventId) {
  const map = {
    'dtx:undergroundInflow': ['출입을 즉시 통제한다','추가 정보를 확인한 뒤 통제한다','부분 통제와 현장확인을 병행한다'],
    'dtx:pumpFailure': ['대체 배수자원을 요청한다','현재 설비 복구를 우선한다','대피를 우선하고 배수는 병행한다'],
    'dtx:powerFailure': ['위험구역 전력을 즉시 차단한다','대피 완료 후 전력을 차단한다','구역별 선택 차단을 실시한다'],
    'dtx:metroSuspension': ['전면 운행중단','해당 역사 무정차 통과','일부 출입구만 폐쇄하고 운행 유지'],
    'dtx:crowdConcentration': ['광장 분산과 출입통제를 동시에 실시한다','교통통제를 우선한다','시민안내를 먼저 시행한다'],
    'dtx:roadCongestion': ['구조차량 전용 진입로를 확보한다','기존 도로에서 신호통제로 진입한다','우회 진입로를 새로 지정한다'],
    'dtx:vulnerablePersonTrapped': ['이동약자를 최우선 구조한다','구역별 위험도 순으로 구조한다','대피 가능한 인원을 먼저 이동시킨다'],
    'dtx:informationDisorder': ['확인된 사실만 즉시 공지한다','모든 사실 확인 후 일괄 공지한다','유언비어 대응과 현장안내를 분리한다'],
    'dtx:emergencyLightingFailure': ['비상전원 전환 후 대피','휴대조명 투입 후 대피','위험구역 폐쇄 후 구조대만 진입']
  };
  return map[eventId] || ['즉시 조치한다','추가 확인 후 조치한다'];
}

function validateScenario(scenario) { return validateStructure(scenario, core); }

function generateScenario(options = {}) {
  const seed = options.seedData || defaultSeed;
  const level = options.level || 'intermediate';
  if (!levelRank[level]) throw new Error(`지원하지 않는 훈련 수준: ${level}`);
  const randomSeed = hashSeed(options.randomSeed ?? `${seed.id}-${level}`);
  for (const key of ['participants','supportOrganizations','requiredTasks','baseEvents','regionFeatures','disasterTypes']) {
    if (!Array.isArray(seed[key]) || seed[key].some(id => !nodes.has(id))) throw new Error('알 수 없는 시드 참조: '+key);
  }
  if (!Number.isFinite(seed.durationMinutes) || seed.durationMinutes < 10 || seed.durationMinutes > 180) throw new Error('훈련시간은 10~180분이어야 합니다.');
  const random = mulberry32(randomSeed);
  const activeAmplifiers = seed.amplifiers
    .filter(a => levelRank[a.minimumLevel] <= levelRank[level])
    .map(a => a.event);
  const eventIds = [...new Set([...seed.baseEvents, ...activeAmplifiers])];
  const orderedEvents = [
    'dtx:undergroundInflow','dtx:pumpFailure','dtx:powerFailure','dtx:emergencyLightingFailure',
    'dtx:metroSuspension','dtx:vulnerablePersonTrapped','dtx:crowdConcentration','dtx:informationDisorder','dtx:roadCongestion'
  ].filter(id => eventIds.includes(id));
  const tasks = seed.requiredTasks.map(id => nodes.get(id)).filter(Boolean);
  const participants = seed.participants.map(id => ({id,label:label(id)}));
  const supportOrganizations = seed.supportOrganizations.map(id => ({id,label:label(id)}));
  const total = orderedEvents.length;
  const stepMinutes = (seed.durationMinutes - 4) / Math.max(total - 1, 1);
  const injects = orderedEvents.map((eventId, index) => {
    const event = nodes.get(eventId);
    return {
      id:`I${String(index+1).padStart(2,'0')}`,
      atMinute:Math.round((2 + index * stepMinutes)*100)/100,
      phase:phaseByIndex[Math.min(index,phaseByIndex.length-1)],
      eventId,
      title:event.label,
      situation:eventNarrative(eventId, seed.location),
      visibleTo:event.visibleTo || [],
      expectedTasks:expectedTaskIds(eventId).filter(id => tasks.some(t => t.id === id)),
      decisionOptions:shuffled(decisionFor(eventId), random),
      informationQuality:index < 2 ? '부분 확인' : (random() > .45 ? '정보 충돌' : '확인 필요')
    };
  });
  const scenario = {
    schemaVersion:'0.2',
    id:`${seed.id}-${level}-${randomSeed}`,
    title:seed.title,
    publicName:seed.publicName,
    location:seed.location,
    trainingMode:seed.trainingMode,
    level,
    durationMinutes:seed.durationMinutes,
    deterministicSeed:randomSeed,
    status:'교육용 시나리오 초안 · 훈련책임자 검토 필요',
    trainingObjectives:seed.trainingObjectives,
    disasterTypes:seed.disasterTypes.map(id => ({id,label:label(id)})),
    regionFeatures:seed.regionFeatures.map(id => ({id,label:label(id)})),
    participants,
    supportOrganizations,
    roleBriefs:seed.participants.map(id => organizationBrief(id, orderedEvents, tasks)),
    tasks:tasks.map(task => ({
      id:task.id,label:task.label,owner:task.ownedBy,dependsOn:task.dependsOn || [],
      deadlineMinutes:Math.min(seed.durationMinutes, task.delayThresholdMinutes),evidence:task.producesEvidence || [],criteria:task.satisfiesCriterion || []
    })),
    injects,
    evaluationCriteria:[...new Set(tasks.flatMap(t => t.satisfiesCriterion || []))].map(id => ({id,label:label(id),description:nodes.get(id)?.description})),
    guardrails:seed.guardrails,
    llmGroundingPackage:{
      instruction:'아래 온톨로지 사실만 사용해 상황카드의 문장을 자연스럽게 확장한다. 기관·수치·임무를 임의로 추가하지 않는다.',
      facts:injects.map(i => ({eventId:i.eventId,event:i.title,visibleTo:i.visibleTo,expectedTasks:i.expectedTasks})),
      tasks:tasks.map(t=>({id:t.id,owner:t.ownedBy,dependsOn:t.dependsOn||[],evidence:t.producesEvidence||[],criteria:t.satisfiesCriterion||[]})),
      outputRule:'모든 상황카드는 발신처, 관측사실, 미확인사항, 요구되는 판단을 구분한다.'
    }
  };
  scenario.validation = validateScenario(scenario);
  return scenario;
}

return {generateScenario,validateScenario};
}
