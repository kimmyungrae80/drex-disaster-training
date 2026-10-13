import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {preview,buildPrompt,runExperiment,createGroqCaller} from '../server/research-service.mjs';
import handler from '../api/research.js';
const base=()=>preview({seed:'test'}).scenario;
const good=()=>JSON.stringify({...base(),brief:'가상 침수 상황. 훈련 조건을 확인합니다.'});
const reply=text=>({text,model:'test-model',id:'test-id',usage:{prompt_tokens:10,completion_tokens:20},finishReason:'stop'});
test('B와 C의 근거 사실은 동일하며 A에는 관계를 주입하지 않는다',()=>{
 const b=preview({mode:'text'}),c=preview({mode:'ontology'}),a=preview({mode:'plain'});
 const bp=buildPrompt(b.options,b.scenario),cp=buildPrompt(c.options,c.scenario),ap=buildPrompt(a.options,a.scenario);
 assert.deepEqual(bp.facts,cp.facts);assert.notEqual(bp.evidence,cp.evidence);assert.equal(ap.evidence,'추가 근거 없음');
 assert.equal(bp.system,cp.system);assert.equal(bp.system,ap.system);
});
test('실제 응답 모델·초안·보정 원문·오류를 분리 보존한다',async()=>{
 const bad=JSON.parse(good());bad.tasks[0].owner='dtx:police';let calls=0;
 const record=await runExperiment({mode:'ontology',repair:true},{transport:'mock',model:'test-model',callModel:async payload=>{calls++;assert.equal(payload.model,'test-model');return reply(calls===1?JSON.stringify(bad):good());}});
 assert.equal(calls,2);assert.equal(record.attempts.length,2);assert.equal(record.attempts[0].validation.valid,false);assert.equal(record.attempts[1].validation.valid,true);assert.equal(record.outcome,'valid');assert.equal(record.eligibleForModelComparison,false);assert.notEqual(record.attempts[0].raw,record.attempts[1].raw);assert.match(record.prompt.sha256,/^[a-f0-9]{64}$/);
});
test('모델 자동 대체 없이 실패를 남긴다',async()=>{
 let calls=0;const r=await runExperiment({repair:true},{transport:'mock',model:'test-model',callModel:async()=>{calls++;throw Object.assign(Error('secret must not appear'),{code:'HTTP_429'});}});
 assert.equal(calls,1);assert.equal(r.outcome,'failed');assert.equal(r.final,null);assert.ok(!JSON.stringify(r).includes('secret must not appear'));
});
test('응답 모델 변경은 비교 가능 상태로 숨기지 않는다',async()=>{
 const r=await runExperiment({},{transport:'live',model:'expected',callModel:async()=>reply(good())});assert.equal(r.modelConsistent,false);assert.equal(r.eligibleForModelComparison,false);
});
test('JSON 실패와 항목 누락을 보존한다',async()=>{
 for(const raw of ['not json',JSON.stringify({...JSON.parse(good()),tasks:[]})]){
  const r=await runExperiment({repair:false},{transport:'mock',model:'test-model',callModel:async()=>reply(raw)});assert.equal(r.outcome,'invalid');assert.equal(r.attempts[0].raw,raw);
 }
});
test('보정 요청 실패도 성공 실험으로 바뀌지 않는다',async()=>{
 let n=0;const r=await runExperiment({repair:true},{transport:'mock',model:'test-model',callModel:async()=>{if(n++)throw Error('unavailable');return reply('not json');}});assert.equal(r.outcome,'failed');assert.equal(r.attempts.length,2);
});
test('등록된 위험사건이라도 필수 상황카드의 사건을 바꾸면 식별한다',async()=>{
 const bad=JSON.parse(good());bad.injects[0].eventId=bad.injects[1].eventId;
 const r=await runExperiment({},{transport:'mock',model:'test-model',callModel:async()=>reply(JSON.stringify(bad))});
 assert.equal(r.outcome,'invalid');assert.ok(r.attempts[0].validation.diagnostics.some(d=>d.code==='EVENT_ID_MISMATCH'));
});
test('전송 계층이 지정 모델과 설정을 보존한다',async()=>{
 const call=createGroqCaller({apiKey:'fixture-only',fetchImpl:async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer fixture-only');const b=JSON.parse(init.body);assert.equal(b.model,'test-model');assert.equal(b.stream,false);return new Response(JSON.stringify({id:'id',model:'test-model',usage:{total_tokens:3},choices:[{message:{content:'{}'},finish_reason:'stop'}]}));}});
 const r=await call({model:'test-model',messages:[],temperature:0.2});assert.equal(r.model,'test-model');assert.equal(r.usage.total_tokens,3);
});
test('API는 키 없이 골격을 보여주고 잘못된 입력·교차출처를 차단한다',async()=>{
 const req=(body,origin)=>new Request('https://example.test/api/research',{method:'POST',headers:origin?{origin}:{},body:JSON.stringify(body)});
 let res=await handler(req({op:'preview',options:{mode:'ontology'}}));assert.equal(res.status,200);assert.equal((await res.json()).scenario.validation.valid,true);
 assert.equal((await handler(req({op:'preview',options:{mode:'__proto__'}}))).status,400);
 assert.equal((await handler(req({op:'preview'},'https://other.test'))).status,403);
});
test('API 스트림은 실제 응답 메타데이터를 포함한 최종 기록을 반환한다',async()=>{
 const beforeKey=process.env.GROQ_API_KEY,beforeModel=process.env.GROQ_MODEL,beforeFetch=globalThis.fetch;
 try{process.env.GROQ_API_KEY='fixture-only';process.env.GROQ_MODEL='test-model';globalThis.fetch=async()=>new Response(JSON.stringify({model:'test-model',id:'fixture',choices:[{message:{content:good()},finish_reason:'stop'}]}));
  const res=await handler(new Request('https://example.test/api/research',{method:'POST',body:JSON.stringify({op:'generate',options:{repair:false}})}));
  assert.match(res.headers.get('content-type'),/event-stream/);const body=await res.text();assert.match(body,/event: progress/);assert.match(body,/event: record/);assert.ok(!body.includes('fixture-only'));
 }finally{globalThis.fetch=beforeFetch;for(const[k,v]of Object.entries({GROQ_API_KEY:beforeKey,GROQ_MODEL:beforeModel}))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('배포용 지식 번들은 원본 데이터와 동일하다',()=>execFileSync(process.execPath,['ontology/src/build-research-data.mjs','--check']));
test('연구 화면 라우팅이 기본 앱보다 먼저 매칭된다',()=>{const routes=JSON.parse(readFileSync('vercel.json')).routes;assert.ok(routes.findIndex(r=>r.src==='/research/?')<routes.length-1);assert.ok(routes.some(r=>r.dest==='/research/$1'));});
