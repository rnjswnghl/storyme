// 저장소 왕복 확인: 임시 항목을 쓰고, 읽고, 지운다. 공개 목록(reviews/chats)에는 아무것도 남기지 않는다.
import { create, one, remove, backend } from '../lib/store.js';
import { json, clientIp, limited } from '../lib/http.js';

export default async function handler(req, res) {
  if (limited(`health:${clientIp(req)}`, 3, 60_000)) return json(res, 429, { error: 'too_many' });
  const steps = {};
  try {
    const item = await create('selftest', { ping: true });
    steps.write = true;
    steps.read = Boolean(await one('selftest', item.id));
    steps.delete = await remove('selftest', item.id);
    return json(res, 200, { ok: steps.read && steps.delete, backend, steps });
  } catch (err) {
    return json(res, 500, { ok: false, backend, steps, error: String(err.message || err).slice(0, 200) });
  }
}
