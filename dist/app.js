// 화면 그리기. 내용은 data/*.json에서, 답하는 로직은 agent/core.js에서 가져온다.
// CSP(script-src 'self')를 지키기 위해 인라인 스크립트·스타일을 쓰지 않고, 모든 글은 textContent로 넣는다.
import { RULES, PRIORITY, tally, answer } from './agent/core.js';

const $ = (sel) => document.querySelector(sel);
const STATUS = { done: '완료', draft: '초안 · 검토 필요', todo: '본인 작성 필요' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

function badge(node, status) {
  if (!node || !status) return;
  node.dataset.s = status;
  node.textContent = STATUS[status] ?? status;
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  const wd = '일월화수목금토'[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${m}월 ${d}일 (${wd})`;
}

function time(iso) {
  return el('time', { datetime: iso, text: fmtDate(iso) });
}

/** "[채움] 문장" → 채움 표시, "[…자리]" → 빈칸 표시 */
function richParagraphs(text) {
  return text.split(/\n{2,}/).map((para) => {
    const p = el('p');
    const parts = para.split(/(\[[^\]]+\])/g);
    for (const part of parts) {
      if (!part) continue;
      if (part === '[채움]') p.append(el('span', { class: 'fill', title: '기록에 없어 흐름을 잇기 위해 에이전트가 채운 문장' , text: '채움' }), ' ');
      else if (/^\[.+\]$/.test(part)) p.append(el('span', { class: 'hole', text: part.slice(1, -1) }));
      else p.append(part);
    }
    return p;
  });
}

function renderHero(records, story) {
  const done = story.criteria.filter((c) => c.status === 'done').length;
  const dds = document.querySelectorAll('#stats dd');
  dds[0].textContent = `${records.counts.days}일`;
  dds[1].textContent = `${records.counts.peerLines}줄`;
  dds[2].textContent = `${done} / ${story.criteria.length}`;
  $('#hero-task').textContent = story.meta.task;
  const legend = $('#legend');
  for (const s of ['done', 'draft', 'todo']) {
    const b = el('span', { class: 'badge' });
    badge(b, s);
    legend.append(b);
  }
  legend.append(el('span', { text: `기록 기간 ${story.meta.period}` }));
  document.querySelectorAll('[data-status-for]').forEach((n) => badge(n, story[n.dataset.statusFor]?.status));
  document.querySelectorAll('[data-status]').forEach((n) => badge(n, n.dataset.status));
}

function renderPassages(story) {
  $('#passages-note').textContent = story.passages.note;
  $('#passages-list').append(
    ...story.passages.items.map((p) =>
      el('li', { class: 'passage' }, time(p.date), el('span', { class: 'tag', text: p.tag }), el('blockquote', { text: p.text }), el('p', { text: p.why })),
    ),
  );
}

function renderRules(story) {
  $('#rules-list').append(...RULES.map((r) => el('li', {}, el('strong', { text: r.title }), el('span', { text: r.body }))));
  $('#priority').textContent = `우선순위 · ${PRIORITY}`;
  $('#rules-note').textContent = story.rules.note;
}

function renderStrengths(records, story) {
  const s = story.strengths;
  $('#strengths-method').textContent = s.method;

  const chosen = new Set(s.items.map((i) => i.key));
  const rows = tally(records);
  const max = Math.max(...rows.map((r) => r.peerCount + r.selfCount));
  $('#tally-chart').append(
    ...rows.map((r) => {
      const peer = el('span', { class: 'bar__peer' });
      const self = el('span', { class: 'bar__self' });
      peer.style.width = `${(r.peerCount / max) * 100}%`;
      self.style.width = `${(r.selfCount / max) * 100}%`;
      return el(
        'div',
        { class: `bar${chosen.has(r.key) ? '' : ' is-off'}`, role: 'listitem', 'aria-label': `${r.name}: 동료 ${r.peerCount}줄, 내 기록 ${r.selfCount}줄, ${r.dayCount}일${chosen.has(r.key) ? ', 강점 지도에 올림' : ', 지운 후보'}` },
        el('span', { class: 'bar__label', text: r.name }),
        el('span', { class: 'bar__track', 'aria-hidden': 'true' }, peer, self),
        el('span', { class: 'bar__n', text: `${r.dayCount}일` }),
      );
    }),
  );

  $('#strength-cards').append(
    ...s.items.map((it, i) =>
      el(
        'article',
        { class: 'strength', id: `strength-${it.key}` },
        el('div', { class: 'strength__head' }, el('h3', { text: `${i + 1}. ${it.name}` }), el('p', { text: it.count })),
        el(
          'div',
          { class: 'strength__grid' },
          el('div', { class: 'cell' }, el('h4', { text: '날짜 있는 장면' }), el('p', { text: it.scene.text }), time(it.scene.date)),
          el('div', { class: 'cell' }, el('h4', { text: '동료가 말한 것' }), el('ul', {}, ...it.peer.map((p) => el('li', {}, `“${p.text}”`, time(p.date))))),
          el('div', { class: 'cell' }, el('h4', { text: '그때 지킨 가치' }), el('p', { text: it.value.text }), time(it.value.date)),
          el(
            'div',
            { class: 'cell' },
            el('h4', { text: '1~8번 과제' }),
            el('ul', {}, ...it.work.map((w) => el('li', {}, el('a', { href: w.url, text: `${w.task} ${w.name}` }), el('br'), w.what))),
          ),
        ),
        el('p', { class: 'critique' }, el('b', { text: '비판 메모 · ' }), it.critique),
      ),
    ),
  );

  $('#removed-list').append(
    ...s.removed.map((r) =>
      el('li', {}, el('s', { text: r.name }), ` · ${r.count} · ${r.confirmed ? '본인 확정' : '에이전트 제안'}`, el('p', { text: r.reason })),
    ),
  );
  if (s.removedByMe.status !== 'done') $('#removed-me').textContent = s.removedByMe.note;
}

function renderStory(story) {
  const st = story.story;
  $('#hardship').textContent = st.hardship.text || st.hardship.prompt;
  $('#third').append(...richParagraphs(st.thirdPerson.text));
  const plain = st.thirdPerson.text.replace(/\[[^\]]+\]/g, '');
  $('#third-meta').textContent = `약 ${plain.replace(/\s/g, '').length}자(공백 제외) · 900자 이내 조건 · "채움"은 기록에 없는 연결 문장`;
  $('#first').textContent = st.firstPerson.text || st.firstPerson.note;
  const box = $('#peer-answers');
  box.append(el('p', { class: 'meta', text: `${st.peerAnswers.note} 질문: ${st.peerAnswers.questions.map((q) => `“${q}”`).join(' / ')}` }));
  const filled = st.peerAnswers.answers.filter((a) => a.same || a.made_up);
  if (filled.length === 0) {
    box.append(el('p', { class: 'todo-line', text: '아직 받은 답이 없습니다. 1인칭 완성본을 먼저 쓴 뒤 동료 두 명에게 읽혀 주세요.' }));
  } else {
    box.append(
      el('div', { class: 'answers' }, ...st.peerAnswers.answers.map((a) => el('dl', { class: 'answer' }, el('dt', { text: a.who }), el('dd', { text: `나 같아? — ${a.same || '(미기록)'}` }), el('dd', { text: `지어낸 느낌? — ${a.made_up || '(미기록)'}` })))),
    );
  }
}

function renderLetter(story) {
  const c = story.coverLetter;
  $('#first-line').textContent = c.firstLine.text || '첫 문장 · 본인이 직접 씁니다';
  $('#last-line').textContent = c.lastLine.text || '마지막 문장 · 본인이 직접 씁니다';
  $('#letter-body').append(...richParagraphs(c.body));
  $('#letter-meta').textContent = `본문 ${c.body.replace(/\s/g, '').length}자(공백 제외) · ${c.note}`;

  const p = story.portfolio;
  $('#portfolio-note').textContent = p.note;
  const cols = story.strengths.items.map((s) =>
    el('section', { class: 'pcol' }, el('h4', { text: s.name }), el('ul', {}, ...s.work.map((w) => el('li', {}, el('span', { class: 'task', text: w.task }), el('a', { href: w.url, text: w.name }), el('br'), w.what)))),
  );
  cols.push(
    el('section', { class: 'pcol pcol--muted' }, el('h4', { text: '배치 미정' }), el('ul', {}, ...p.unplaced.map((w) => el('li', {}, el('span', { class: 'task', text: w.task }), el('a', { href: w.url, text: w.name }))))),
  );
  $('#portfolio').append(...cols);
}

function renderCheck(story) {
  $('#criteria').append(
    ...story.criteria.map((c) => {
      const b = el('span', { class: 'badge' });
      badge(b, c.status);
      return el('tr', {}, el('td', { text: c.id.replace('T09-', '') }), el('td', { text: c.text }), el('td', {}, b));
    }),
  );
  const j = story.judgement;
  const judge = $('#judge');
  judge.append(
    el('dt', { text: '① AI에게 맡긴 일' }), el('dd', { text: j.aiDid }),
    el('dt', { text: '② 내가 직접 판단한 일' }), el('dd', { text: j.iDecided }),
    el('dt', { text: '③ AI 제안을 따르지 않은 일' }), el('dd', { text: j.iRejected.text || '본인 작성 필요 · 없었다면 왜 없었는지를 적습니다.' }),
  );
  const v = story.verify;
  $('#verify').append(
    el('dt', { text: '위치' }), el('dd', { text: v.where }),
    el('dt', { text: '행동' }), el('dd', { text: v.steps }),
    el('dt', { text: '통과 모습' }), el('dd', { text: v.pass }),
    el('dt', { text: '실패 모습' }), el('dd', { text: v.fail }),
  );
}

/* ── 에이전트 대화 ───────────────────────────── */
const EXAMPLES = ['내 강점이 뭐야?', '가장 힘들었던 날은?', '동료들은 나를 어떻게 봐?', '정리를 잘한 장면', '9월 8일', '에이전트 규칙이 뭐야?'];

async function aiEnabled() {
  try {
    const r = await fetch('/api/ask', { method: 'GET', headers: { accept: 'application/json' } });
    if (!r.ok) return false;
    const j = await r.json();
    return j.enabled === true;
  } catch {
    return false;
  }
}

function renderTurn(q, res) {
  const turn = el('article', { class: 'turn' }, el('p', { class: 'turn__q', text: `Q. ${q}` }), el('p', { class: 'turn__a', text: res.answer }));
  if (res.citations?.length) {
    turn.append(el('ul', { class: 'cites', 'aria-label': '근거 기록' }, ...res.citations.map((c) => el('li', {}, el('time', { datetime: c.date, text: `${fmtDate(c.date)} · ${c.label}` }), c.text))));
  }
  return turn;
}

function setupAsk(records, story) {
  const form = $('#ask-form');
  const input = $('#ask-input');
  const log = $('#log');
  const button = form.querySelector('button');
  let useAi = false;
  aiEnabled().then((on) => {
    useAi = on;
    const mode = $('#mode');
    mode.dataset.mode = on ? 'ai' : 'local';
    mode.textContent = on ? 'AI 모드 · 기록만 근거로 답함' : '기록 검색 모드';
  });

  async function ask(q) {
    q = q.trim();
    if (!q) return;
    button.disabled = true;
    let res = null;
    if (useAi) {
      try {
        const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) });
        if (r.ok) res = await r.json();
      } catch {
        res = null;
      }
    }
    if (!res) res = answer(records, story, q);
    log.prepend(renderTurn(q, res));
    button.disabled = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
    input.value = '';
  });
  $('#chips').append(
    ...EXAMPLES.map((q) => {
      const b = el('button', { type: 'button', text: q });
      b.addEventListener('click', () => ask(q));
      return b;
    }),
  );
}

async function main() {
  const [records, story] = await Promise.all([fetch('data/records.json').then((r) => r.json()), fetch('data/story.json').then((r) => r.json())]);
  renderHero(records, story);
  renderPassages(story);
  renderRules(story);
  renderStrengths(records, story);
  renderStory(story);
  renderLetter(story);
  renderCheck(story);
  setupAsk(records, story);
}

main().catch((err) => {
  const main = $('#main');
  main.prepend(el('p', { class: 'notice', text: `기록 파일을 읽지 못했습니다(${err.message}). 서사 문서 T09-narrative.md를 확인해 주세요.` }));
});
