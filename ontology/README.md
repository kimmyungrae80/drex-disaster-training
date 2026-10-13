# 재난협업훈련 시나리오 연구 엔진 v0.2

저장소의 기관·임무·선행관계·평가기준을 이용해 교육용 골격을 만들고, 실제 Groq API에 전달하여 AI 시나리오를 생성·검증합니다. 연구 화면은 `/research/`이며 기존 홈 화면에서 진입할 수 있습니다. 연구 결과를 기존 실무훈련 세션이나 CPX에 자동 주입하는 기능은 아직 없습니다.

## 지식과 구현 범위

`data/core-knowledge.v0.1.jsonld`에는 54개 노드가 있습니다. 재난유형 4, 지역특성 5, 기관 7, 업무 9, 평가기준 7, 위험사건 10, 인과규칙 7, 반복 지적사항 5개입니다. 현재 서울 도심 지하공간 침수 시드는 이 중 업무 8개, 평가기준 6개, 참여기관 4개와 지원기관 3개를 사용합니다. 초급·중급·고급의 상황카드는 각각 6·8·9개입니다.

이 구현은 JSON-LD 관계 자료와 명시적 JavaScript 규칙을 사용합니다. 사건 순서·사건별 기대업무·난이도 증폭은 코드와 시드에 정의되어 있으며, `CausalRule` 노드를 실행하는 범용 추론기나 OWL/SHACL 검증기는 아닙니다. 지역명 변경은 표시 텍스트를 바꾸며 지역별 지식 검색을 수행하지 않습니다.

모든 지식은 `curated-unverified` 상태입니다. [출처 목록](data/provenance.v0.2.json)은 노드별 내부 파일과 기존 source 선언을 보존합니다. 공식 문서명·페이지·전문가·승인일은 확인 전이므로 null입니다. 이 파일의 작성이 출처 검증이나 전문가 승인을 의미하지 않습니다.

`docs/training-data.json`의 1,915건은 보고서 본문이 아닌 파일 메타데이터입니다. 원문 경로 누락과 문자 깨짐이 있어 학습·검색에 사용하지 않습니다.

## 생성과 검증

세 조건의 공통 입력은 훈련목표, 기관, 필요한 업무·사건 ID, 평가기준입니다.

| 조건 | 추가 근거 | 해석 |
|---|---|---|
| A `plain` | 없음 | 공통 입력만으로 생성 |
| B `text` | 선택된 사실을 필드 경로와 값의 문장 목록으로 변환 | 문장형 근거, RAG 아님 |
| C `ontology` | B와 같은 사실을 중첩 JSON으로 표현 | 관계 구조 표현 |

모든 조건이 같은 출력 규격과 검증기를 사용합니다. 기관·업무·평가 참조, 자기참조·순환, 내부 업무 소유·선행·평가 관계와의 일치, 시간 범위·상황 순서, 필수 항목 포함 여부를 검사합니다. 문장 의미의 타당성, 자원량 적정성, 실제 대응 효과는 검사하지 않습니다. 업무 기한과 상황 시각의 범위 검사가 실제 조치 이행 순서까지 증명하지는 않습니다.

선택적 1회 보정은 동일 모델에 오류 목록을 전달합니다. 최초 원문을 덮어쓰지 않으며 초안/보정의 파싱 결과와 오류를 각각 기록합니다. 자동 모델 대체는 없습니다. 키 미설정 또는 호출 실패를 가짜 AI 결과로 대체하지 않습니다.

## 웹 사용

1. Vercel의 기존 `GROQ_API_KEY` 서버 환경변수를 사용합니다. `GROQ_MODEL` 미설정 시 코드의 기본 요청값은 `openai/gpt-oss-120b`입니다. 실제 공급자 지원 여부는 호출 시 확인해야 합니다.
2. `/research/`에서 조건을 선택하고 생성합니다. `규칙 기반 골격 확인`은 키나 AI 호출이 필요 없습니다.
3. 현재 기록은 JSON, 최근 10건은 JSONL로 내려받습니다. 브라우저 저장은 장기 보관이나 공동 연구 DB를 대신하지 않습니다.

`api/research.js`는 진행 상태와 최종 기록을 SSE로 전달합니다. 실제 모델 이름, 응답 ID, 사용량, 종료 사유, 지식·프롬프트 해시, 서버 커밋 SHA(환경변수가 있으면)가 기록됩니다. 보정까지 포함한 요청은 시간이 걸릴 수 있으며 공급자나 배포환경의 시간 제한은 별도 확인이 필요합니다.

## CLI 실험계획

Node.js 22 이상을 권장합니다. 외부 npm 패키지는 필요 없습니다.

```bash
# AI를 호출하지 않고 27회 계획만 생성
node research/run.mjs --out research-runs/pilot-plan

# 기존 서버와 같은 Groq 키를 환경변수로 준비한 뒤 1회 연결 점검
node research/run.mjs --live --max-runs 1 --out research-runs/connection-check

# 실제 27회 호출: 계획·비용을 검토하고 실행
node research/run.mjs --live --repetitions 3 --max-runs 27 --out research-runs/pilot-live
```

키를 명령행 인자나 저장소에 넣지 마세요. `GROQ_MODEL`은 한 실험에서 고정하고 `DREX_SOURCE_REVISION`에 실제 커밋 SHA를 지정할 수 있습니다. 같은 출력 폴더를 재사용하면 덮어쓰지 않고 중단합니다. 공급자 실패 시 중단하며 이어 실행 기능은 없습니다. 일부만 실행한 계획을 완료된 27회 실험으로 보고해서는 안 됩니다.

## 구조와 시험

- `src/scenario-core.mjs`: 파일 입출력 없는 규칙 기반 골격 엔진
- `src/scenario-generator.mjs`: Node CLI 래퍼
- `src/validation.mjs`: 구조·내부 관계 검증
- `src/research-data.mjs`: Edge 배포용 데이터 번들
- `../server/research-service.mjs`: 조건별 프롬프트·AI 호출·기록
- `../api/research.js`, `../research/`: 연구 API·화면·실험 CLI

지식을 수정하면 번들을 다시 생성하고 출처 목록도 갱신해야 합니다.

```bash
node ontology/src/build-research-data.mjs
node ontology/src/build-research-data.mjs --check
node ontology/tests/scenario-generator.test.mjs
node --test ontology/tests/validation.test.mjs tests/research.test.mjs tests/practical.test.mjs tests/practical-service.test.mjs tests/practical-config.test.mjs
```

자세한 표본 구성과 논문 주장 범위는 [실험 프로토콜](../docs/RESEARCH-PROTOCOL.md)을 참고하세요. 교육용 시간·기관 임무를 실제 대응 매뉴얼로 확정하려면 공식 원문 대조와 전문가 검토가 필요합니다.
