import {preview,runExperiment,createGroqCaller} from '../server/research-service.mjs';
export const config={runtime:'edge'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async function handler(req){
  if(req.method!=='POST')return json({error:'POST 요청만 지원합니다.'},405);
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return json({error:'같은 사이트에서 요청하세요.'},403);
  if(Number(req.headers.get('content-length')||0)>12000)return json({error:'요청이 너무 큽니다.'},413);
  let body;
  try{const text=await req.text();if(text.length>12000)return json({error:'요청이 너무 큽니다.'},413);body=JSON.parse(text);}
  catch{return json({error:'JSON 요청을 확인하세요.'},400);}
  try{
    if(body?.op==='preview')return json(preview(body.options));
    if(body?.op!=='generate')return json({error:'지원하지 않는 작업입니다.'},400);
    const checked=preview(body.options);
    if(!process.env.GROQ_API_KEY)return json({error:'기존 GROQ_API_KEY 서버 설정이 필요합니다. 골격 확인은 사용할 수 있습니다.'},503);
    const encoder=new TextEncoder();let closed=false,heartbeat;
    const stream=new ReadableStream({
      async start(controller){
        const send=(event,data)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
        send('progress',{message:'AI 생성과 검증을 진행합니다.'});
        heartbeat=setInterval(()=>send('progress',{message:'응답을 기다리고 있습니다.'}),10000);
        try{
          const result=await runExperiment(checked.options,{callModel:createGroqCaller({apiKey:process.env.GROQ_API_KEY}),model:process.env.GROQ_MODEL||'openai/gpt-oss-120b'});
          result.sourceRevision=process.env.VERCEL_GIT_COMMIT_SHA||null;send('record',result);
        }catch{send('error',{error:'연구 요청 처리에 실패했습니다. 성공 표본으로 저장되지 않았습니다.'});}
        finally{clearInterval(heartbeat);if(!closed){closed=true;controller.close();}}
      },
      cancel(){closed=true;clearInterval(heartbeat);}
    });
    return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return json({error:'연구 입력값 또는 시나리오 구성을 확인하세요.'},400);}
}
