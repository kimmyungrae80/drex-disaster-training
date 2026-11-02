// Exercise assumptions are explicit teaching rules, not hazard predictions or official scores.
export const VERSION = 'DREX-EXERCISE-2';
export const ACTIONS = {
  verify: {name:'현장 인원 확인',minutes:2,effect:'countKnown',site:'facility'},
  traffic: {name:'진입로 확인·통제',minutes:3,effect:'roadOpen',site:'road'},
  isolate: {name:'전기 위험 확인·안전조치',minutes:4,effect:'powerSafe',site:'facility'},
  shelter: {name:'대피시설 준비',minutes:3,effect:'shelterReady',site:'shelter'},
  warning: {name:'대피 안내 전파',minutes:2,effect:'warningIssued',site:'facility'},
  rescue: {name:'현장 구조·대피 지원',minutes:5,effect:'rescueComplete',site:'facility',requires:['roadOpen','powerSafe','shelterReady']},
};
export const DEFAULT_ORGS = [
  {id:'hq',name:'지자체 상황총괄',capabilities:['warning']},
  {id:'fire',name:'소방',capabilities:['verify','rescue']},
  {id:'police',name:'경찰',capabilities:['traffic']},
  {id:'works',name:'시설관리',capabilities:['isolate']},
  {id:'welfare',name:'대피·구호',capabilities:['shelter']},
];
export const OBJECTIVES = [
  {id:'information',title:'서로 다른 정보를 확인하고 공유한다',target:'신고 인원과 현장 확인 결과를 구분하고, 출처를 확인해 판단에 반영한다.',source:'교육용 목표 · 적용 기관의 매뉴얼로 검토 필요'},
  {id:'coordination',title:'기관 간 지원 요청을 끝까지 연결한다',target:'요청을 접수하고 자원을 배정한 뒤, 결과를 요청 기관이 확인한다.',source:'교육용 목표 · 기관 간 협업 절차로 검토 필요'},
  {id:'judgment',title:'판단 근거와 조치 결과를 남긴다',target:'당시 알고 있던 정보와 판단 이유를 기록하고 결과를 확인한다.',source:'교육용 목표 · 공식 평가점수와 별도'},
];
