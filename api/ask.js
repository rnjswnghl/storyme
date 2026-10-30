// 선택 기능: 외부 AI로 답하는 모드.
// ANTHROPIC_API_KEY가 없으면 GET은 {enabled:false}를 돌려주고, 화면은 기록 검색 모드로만 동작한다.
// 키는 서버에만 있고 브라우저로 내려가지 않는다. 답의 근거는 항상 기록에서 다시 뽑아 함께 돌려준다.
import { answer, systemPrompt, contextFor } from '../dist/agent/core.js';
import { loadData } from '../lib/data.js';
import { json, readBody, clientIp, limited } from '../lib/http.js';

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return json(res, 200, { enabled: Boolean(key) });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = await readBody(req);
  const q = String(body.q ?? '').trim().slice(0, 200);
  if (!q) return json(res, 400, { error: 'empty_question' });

  const { records, story } = await loadData();
  const local = answer(records, story, q);
  if (!key || limited(`ask:${clientIp(req)}`, 8, 60_000)) return json(res, 200, local);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: systemPrompt(story),
        messages: [{ role: 'user', content: `질문: ${q}\n\n근거로 쓸 수 있는 기록(이 밖의 내용은 지어내지 말 것):\n${contextFor(records, q)}` }],
      }),
    });
    if (!r.ok) return json(res, 200, local);
    const data = await r.json();
    const textOut = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return json(res, 200, textOut ? { mode: 'ai', answer: textOut, citations: local.citations } : local);
  } catch {
    return json(res, 200, local);
  }
}
