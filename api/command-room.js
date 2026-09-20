import {makeRoomHandler} from '../server/command-room-service.mjs';
import {makeRoomStore} from '../server/command-room-store.mjs';
export const config={runtime:'edge'};
async function generate(scenario){
 const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',messages:[{role:'system',content:'재난훈련 시나리오의 제목과 초기 브리핑을 한국어로 작성한다. 입력의 지역·재난유형·인원·시간을 그대로 유지한다. 새로운 피해 수치, 실제 발생 주장, 실제 시설 이름을 만들지 않는다. JSON 객체 {"title":"...","brief":"..."}만 반환한다.'},{role:'user',content:JSON.stringify(scenario)}],max_tokens:1800,response_format:{type:'json_object'}})});
 if(!res.ok)throw Error('AI unavailable');const data=await res.json();return JSON.parse(data.choices[0].message.content);
}
export default function handler(req){return makeRoomHandler(makeRoomStore(process.env),{generate:process.env.GROQ_API_KEY?generate:null})(req);}
