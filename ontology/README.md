# 재난협업훈련 온톨로지 기반 시나리오 엔진 v0.1

기존 DREX 저장소에 축적된 기관·임무·협업기능·평가항목·반복 지적사항을 관계형 지식으로 정리하고, 그 지식을 근거로 재현 가능한 훈련 시나리오 골격을 생성하는 모듈입니다.

## 왜 온톨로지가 필요한가

일반적인 생성형 AI는 그럴듯한 재난 이야기는 잘 만들지만 다음을 보장하지 못합니다.

- 모든 조치에 수행기관이 지정됐는가
- 선행조치가 끝나기 전에 후속조치가 실행되지는 않았는가
- 특정 기관만 알고 있는 정보가 구분됐는가
- 기관 간 요청과 회신이 실제 상황 변화에 연결되는가
- 평가항목을 뒷받침할 행동근거가 남는가

이 모듈은 AI가 자유롭게 이야기를 만드는 대신, 온톨로지에서 유효한 사실과 관계를 먼저 가져와 시나리오 골격을 만든 뒤 AI가 문장만 자연스럽게 확장하도록 설계했습니다.

## 데이터의 현재 상태

### 바로 사용할 수 있는 구조화 지식

- `index.html`의 `ISSUES`: 기관·재난유형별 반복 지적사항
- `index.html`의 `EVAL_CRITERIA`: 재난유형별 평가 핵심어
- `index.html`의 `COLLAB_MAP`: 재난유형별 기관·자원·임무
- `index.html`의 `TTX_SOP`, `MX_DOMAINS`: SOP와 훈련평가 구조
- `practical/engine.mjs`: 기관·업무·선행관계·완료근거
- `docs/practical-samples/checklist.json`: 기한·배점·판정기준

### 정제가 필요한 데이터

`docs/training-data.json`은 1,915건의 보고서 원문이 아니라 파일 메타데이터입니다. 일부 한글 파일명과 기관명이 깨져 있고 `source_path`가 비어 있어, 현재 상태로는 보고서 본문의 지적사항과 우수사례를 추출할 수 없습니다.

따라서 v0.1은 저장소 안에서 의미가 확인된 구조화 지식만 사용합니다. 이후 원문 HWP·PDF를 확보하면 텍스트 추출 → 비식별화 → 지식후보 추출 → 전문가 승인 절차를 거쳐 확장해야 합니다.

## 구성

```text
ontology/
├── schema/
│   └── disaster-training-context.jsonld
├── data/
│   ├── core-knowledge.v0.1.jsonld
│   └── seoul-urban-flood.seed.json
├── src/
│   └── scenario-generator.mjs
├── tests/
│   └── scenario-generator.test.mjs
└── examples/
    └── seoul-urban-flood.intermediate.json
```

## 핵심 관계

```text
재난유형 ─mayTrigger→ 위험사건
지역특성 ─amplifiedBy→ 위험사건
위험사건 ─requires→ 기관별 업무
업무 ─ownedBy→ 수행기관
업무 ─dependsOn→ 선행업무
업무 ─producesEvidence→ 완료근거
업무 ─satisfiesCriterion→ 평가항목
위험사건 ─visibleTo→ 정보를 받는 기관
```

예를 들어 다음 관계가 시나리오에 강제됩니다.

```text
지하공간 유입
→ 교통공사의 승객현황 확인
→ 경찰의 출입통제·구조 진입로 확보
→ 교통공사의 전력차단 안전확인
→ 소방의 고립자 구조
```

따라서 소방이 전력차단과 진입로 확보 전에 고립자 구조를 완료하는 비현실적인 시나리오를 생성하지 않도록 검증할 수 있습니다.

## 실행

Node.js 18 이상에서 외부 패키지 없이 실행됩니다.

```bash
node ontology/src/scenario-generator.mjs \
  --level intermediate \
  --seed seoul-demo-01 \
  --output ontology/examples/seoul-urban-flood.intermediate.json
```

테스트:

```bash
node ontology/tests/scenario-generator.test.mjs
```

## 생성 결과

생성기는 다음을 하나의 JSON으로 만듭니다.

- 훈련목표와 지역특성
- 참여기관과 지원기관
- 기관별 차등정보와 임무카드
- 선행관계를 가진 공동대응 업무
- 시간순 상황카드와 의사결정 대안
- 완료근거와 평가항목 연결
- 생성형 AI에 전달할 제한형 근거 패키지
- 구조 검증 결과

## 현재 시뮬레이션과의 연결

권장 흐름은 다음과 같습니다.

```text
훈련조건 입력
→ 온톨로지 하위그래프 검색
→ 규칙 기반 시나리오 골격 생성·검증
→ AI가 상황카드 문장과 브리핑 자료 작성
→ 훈련통제관 승인
→ 재난협업훈련 시뮬레이션 실행
→ 행동로그를 같은 온톨로지의 업무·평가기준에 연결
```

AI는 기관 임무·업무 의존성·평가기준을 새로 만들지 않습니다. AI의 역할은 승인된 지식그래프를 바탕으로 상황문과 보고서 초안을 작성하는 것으로 제한합니다.

## 다음 확장

1. `training-data.json`의 한글 인코딩 복구와 중복 정리
2. 원문 HWP·PDF 확보 및 텍스트 추출
3. 반복 지적사항·우수사례·기관 임무를 지식후보로 자동 추출
4. 출처 문서와 페이지를 모든 지식노드에 연결
5. 전문가 승인 전 지식은 `candidate`, 승인 후 `verified`로 상태관리
6. 서울 도심 외에 산불·화학사고·지진·산업단지·BCP 시드 추가
7. 웹 화면의 AI 시나리오 생성 단계와 API 연동

## 주의사항

이 모듈의 시간·자원·피해수치는 교육용 가정입니다. 공식 매뉴얼이나 실제 재난예측을 대체하지 않으며, 시나리오 확정과 평가판정은 훈련책임자가 검토해야 합니다.
