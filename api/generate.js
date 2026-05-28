export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
};

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

    // Anthropic 형식 → Groq(OpenAI) 형식 변환
    const messages = [];
    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    messages.push(...(body.messages || []));

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: body.max_tokens || 2000,
        stream: true,
        messages,
      }),
    });

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
