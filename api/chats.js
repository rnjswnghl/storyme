// 남긴 대화. GET 목록(?id= 하나) / POST 남기기 / DELETE 지우기(소유자만)
// 답변은 클라이언트가 보낸 글을 믿지 않고 서버에서 기록 검색으로 다시 만든다.
// 그래야 남겨진 대화가 실제 에이전트의 답이라는 것이 보장된다.
import { create, all, one, remove } from '../lib/store.js';
import { json, readBody, clientIp, limited, text, isOwner } from '../lib/http.js';
import { loadData } from '../lib/data.js';
import { answer } from '../dist/agent/core.js';

const PREFIX = 'chats';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');

    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        const item = await one(PREFIX, id);
        return item ? json(res, 200, { item }) : json(res, 404, { error: '없는 대화입니다.' });
      }
      const items = (await all(PREFIX)).map(({ id: i, createdAt, title, turns }) => ({ id: i, createdAt, title, count: turns.length }));
      return json(res, 200, { items, ownerEnabled: Boolean(process.env.OWNER_KEY) });
    }

    if (req.method === 'POST') {
      if (limited(`chat:${clientIp(req)}`, 6, 10 * 60_000)) return json(res, 429, { error: '잠시 뒤에 다시 남겨 주세요.' });
      const body = await readBody(req);
      const questions = Array.isArray(body.questions) ? body.questions.slice(0, 20) : [];
      if (questions.length === 0) return json(res, 400, { error: '남길 질문이 없습니다.' });
      const { records, story } = await loadData();
      const turns = [];
      for (const raw of questions) {
        const q = text(raw, { max: 200, min: 1, field: '질문' });
        if (q.error) return json(res, 400, { error: q.error });
        const a = answer(records, story, q.value);
        turns.push({ q: q.value, answer: a.answer, citations: a.citations });
      }
      const title = turns[0].q.slice(0, 40);
      const item = await create(PREFIX, { title, turns });
      return json(res, 201, { item: { id: item.id, createdAt: item.createdAt, title, count: turns.length } });
    }

    if (req.method === 'DELETE') {
      if (!isOwner(req)) return json(res, 403, { error: '소유자 키가 맞지 않습니다.' });
      return json(res, (await remove(PREFIX, url.searchParams.get('id') || '')) ? 200 : 404, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('chats', err);
    return json(res, 500, { error: '저장소에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
  }
}
