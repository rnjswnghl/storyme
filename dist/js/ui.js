// 세 페이지가 함께 쓰는 작은 도구들. 모든 글은 textContent로 넣는다(CSP·XSS).
export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

const WD = '일월화수목금토';
export function fmtDate(iso, { weekday = true } = {}) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일${weekday ? ` ${WD[d.getUTCDay()]}요일` : ''}`;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const STATUS = { done: '완료', draft: '초안 · 검토 필요', todo: '직접 작성 필요' };
export function pill(status, label) {
  return el('span', { class: 'pill', 'data-s': status, text: label ?? STATUS[status] ?? status });
}

export async function getJSON(url, init) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, ...init });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || `요청 실패 (${r.status})`), { status: r.status });
  return body;
}

export function loadData() {
  return Promise.all([getJSON('data/records.json'), getJSON('data/story.json')]).then(([records, story]) => ({ records, story }));
}

/** "[채움] 문장" → 채움 표시, "[…자리]" → 빈칸 표시 */
export function paragraphs(text) {
  return text.split(/\n{2,}/).map((para) => {
    const p = el('p');
    for (const part of para.split(/(\[[^\]]+\])/g)) {
      if (!part) continue;
      if (part === '[채움]') p.append(el('span', { class: 'fill', title: '기록에 없어 흐름을 잇기 위해 에이전트가 채운 문장', text: '채움' }));
      else if (/^\[.+\]$/.test(part)) p.append(el('span', { class: 'hole', text: part.slice(1, -1) }));
      else p.append(part);
    }
    return p;
  });
}

export function toast(message) {
  const t = el('div', { class: 'toast', role: 'status', text: message });
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장할 수 없는 환경(사생활 보호 창 등)에서는 이번 방문 동안만 유지한다 */
    }
  },
};

// 스크롤하면 상단 바에 경계선
const bar = $('.bar');
if (bar) {
  const onScroll = () => bar.toggleAttribute('data-scrolled', window.scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
