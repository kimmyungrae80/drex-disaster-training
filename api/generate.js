export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
};

// 한국어 강제 규칙 — 모든 호출에 서버측 주입 (llama 계열의 한자 혼입 방지)
const KO_SYSTEM =
  '당신은 대한민국 재난안전 훈련 전문가입니다. ' +
  '모든 응답은 반드시 표준 한국어(한글)로만 작성하세요. ' +
  '한자(漢字), 중국어 간체/번체, 일본어 문자는 절대 사용 금지입니다. ' +
  '영어는 RTO, SOP 같은 표준 약어에만 허용됩니다. ' +
  'JSON으로 응답할 때도 모든 문자열 값은 한글로만 작성하세요.';

// 한국어 품질이 좋은 모델을 우선 사용하고, 미지원 계정이면 llama로 폴백
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';

async function callGroq(apiKey, model, messages, maxTokens) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages,
    }),
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: CORS });
  }

  try {
    const body = await req.json();
    const sessionId = req.headers.get('X-Session-ID') || 'unknown';
    console.log(`[DREX] session=${sessionId}`);

    // Anthropic 형식 → Groq(OpenAI) 형식 변환 + 한국어 규칙 서버측 주입
    const messages = [];
    messages.push({ role: 'system', content: body.system ? KO_SYSTEM + '\n\n' + body.system : KO_SYSTEM });
    messages.push(...(body.messages || []));

    const maxTokens = body.max_tokens || 2000;
    let groqResp = await callGroq(apiKey, PRIMARY_MODEL, messages, maxTokens);
    if (!groqResp.ok) {
      console.log(`[DREX] primary model failed (${groqResp.status}) → fallback ${FALLBACK_MODEL}`);
      groqResp = await callGroq(apiKey, FALLBACK_MODEL, messages, maxTokens);
    }

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      return new Response(JSON.stringify({ error: errText }), { status: groqResp.status, headers: CORS });
    }

    // Groq SSE → Anthropic SSE 형식으로 변환하여 스트리밍
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqResp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        // Anthropic 시작 이벤트
        controller.enqueue(encoder.encode(
          'data: {"type":"message_start","message":{"id":"msg_groq","type":"message","role":"assistant","content":[]}}\n\n' +
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n'
        ));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) {
                const evt = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
              }
            } catch {}
          }
        }

        // Anthropic 종료 이벤트
        controller.enqueue(encoder.encode(
          'data: {"type":"content_block_stop","index":0}\n\n' +
          'data: {"type":"message_stop"}\n\n'
        ));
        controller.close();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
