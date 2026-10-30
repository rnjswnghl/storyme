// 동료 평가(댓글). GET 목록 / POST 남기기 / DELETE 지우기(소유자만)
// 이름은 받지 않는다. 별칭은 "동료 A"처럼 실명이 아닌 표기만 쓰도록 화면에서 안내한다.
import { create, all, remove, backend } from '../lib/store.js';
import { json, readBody, clientIp, limited, text, isOwner } from '../lib/http.js';

const PREFIX = 'reviews';
const CHOICE = new Set(['yes', 'partly', 'no']);
const VERSION = new Set(['third', 'first']);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const items = await all(PREFIX);
      return json(res, 200, { items, ownerEnabled: Boolean(process.env.OWNER_KEY), backend });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.website) return json(res, 200, { ok: true }); // 봇이 채우는 숨은 칸
      if (limited(`review:${clientIp(req)}`, 4, 10 * 60_000)) {
        return json(res, 429, { error: '잠시 뒤에 다시 남겨 주세요. 10분에 4개까지 남길 수 있어요.' });
      }
      if (!CHOICE.has(body.same) || !CHOICE.has(body.madeUp)) return json(res, 400, { error: '두 질문에 모두 답해 주세요.' });
      const fields = {
        alias: text(body.alias || '익명 동료', { max: 12, field: '별칭' }),
        sameNote: text(body.sameNote, { max: 300, field: '"나 같아?" 의견' }),
        madeUpNote: text(body.madeUpNote, { max: 300, field: '"지어낸 느낌" 의견' }),
        comment: text(body.comment, { max: 600, field: '하고 싶은 말' }),
      };
      const bad = Object.values(fields).find((f) => f.error);
      if (bad) return json(res, 400, { error: bad.error });
      const item = await create(PREFIX, {
        alias: fields.alias.value,
        version: VERSION.has(body.version) ? body.version : 'third',
        same: body.same,
        sameNote: fields.sameNote.value,
        madeUp: body.madeUp,
        madeUpNote: fields.madeUpNote.value,
        comment: fields.comment.value,
      });
      return json(res, 201, { item });
    }

    if (req.method === 'DELETE') {
      if (!isOwner(req)) return json(res, 403, { error: '소유자 키가 맞지 않습니다.' });
      const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
      return json(res, (await remove(PREFIX, id)) ? 200 : 404, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('reviews', err);
    return json(res, 500, { error: '저장소에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
  }
}
