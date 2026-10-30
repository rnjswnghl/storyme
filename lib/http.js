// API 공통: 응답, 본문 읽기, 호출 제한, 입력 검사, 소유자 확인.
import { timingSafeEqual } from 'node:crypto';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64_000) return {};
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
}

// 인스턴스 단위의 가벼운 호출 제한. 완벽한 방어가 아니라 실수·장난 반복을 줄이는 장치다.
const windows = new Map();
export function limited(key, max, ms) {
  const now = Date.now();
  const list = (windows.get(key) || []).filter((t) => now - t < ms);
  list.push(now);
  windows.set(key, list);
  return list.length > max;
}

const CONTACT = [
  [/https?:\/\/|www\.|\.(com|net|kr|io|me)\b/i, '링크'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, '이메일'],
  [/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/, '전화번호'],
];

/** 글자 수 제한·제어문자 제거·연락처 차단. 문제가 있으면 { error } 를 돌려준다. */
export function text(value, { max, min = 0, field }) {
  const v = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (v.length < min) return { error: `${field}을(를) ${min}자 이상 적어 주세요.` };
  if (v.length > max) return { error: `${field}은(는) ${max}자까지 쓸 수 있어요.` };
  for (const [re, what] of CONTACT) if (re.test(v)) return { error: `${field}에 ${what}는 남길 수 없어요. 공개되는 페이지라서요.` };
  return { value: v };
}

/** OWNER_KEY 환경 변수와 요청 헤더 x-owner-key를 비교한다. 키가 설정되지 않으면 항상 거부. */
export function isOwner(req) {
  const key = process.env.OWNER_KEY;
  const given = String(req.headers['x-owner-key'] || '');
  if (!key || !given) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
