// 선택 기능: 외부 AI로 답하는 모드.
// ANTHROPIC_API_KEY 환경 변수가 없으면 GET은 {enabled:false}를 돌려주고, 페이지는 기록 검색 모드로만 동작한다.
// 키는 서버에만 있고 브라우저로 내려가지 않는다. 답의 근거는 항상 기록에서 다시 뽑아 함께 돌려준다.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { answer, systemPrompt, contextFor, search } from '../dist/agent/core.js';

const root = process.cwd();
let cache;
async function load() {
  if (!cache) {
    const [records, story] = await Promise.all([
      readFile(path.join(root, 'dist/data/records.json'), 'utf8').then(JSON.parse),
      readFile(path.join(root, 'dist/data/story.json'), 'utf8').then(JSON.parse),
    ]);
    cache = { records, story };
  }
  return cache;
}

// 인스턴스 단위의 가벼운 호출 제한(분당 IP당 8회). 공개 페이지에서 키가 남용되지 않게 하는 최소 장치.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return json(res, 200, { enabled: Boolean(key) });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = await readBody(req);
  const q = String(body.q ?? '').trim().slice(0, 200);
  if (!q) return json(res, 400, { error: 'empty_question' });

  const { records, story } = await load();
  const local = answer(records, story, q);
  if (!key) return json(res, 200, local);

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return json(res, 200, { ...local, note: 'rate_limited' });

  const context = contextFor(records, q);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: systemPrompt(story),
        messages: [{ role: 'user', content: `질문: ${q}\n\n근거로 쓸 수 있는 기록(이 밖의 내용은 지어내지 말 것):\n${context}` }],
      }),
    });
    if (!r.ok) return json(res, 200, local);
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) return json(res, 200, local);
    const citations = local.citations.length ? local.citations : search(records, q, 5).map((c) => ({ date: c.date, label: c.label, text: c.text }));
    return json(res, 200, { mode: 'ai', answer: text, citations });
  } catch {
    return json(res, 200, local);
  }
}
