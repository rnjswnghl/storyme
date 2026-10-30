// 기록 페이지: 날짜 격자, 강점, 이야기, 자기소개서, 포트폴리오, 규칙, 제출 점검
import { RULES, PRIORITY, perDay } from '../agent/core.js';
import { $, el, fmtDate, pill, getJSON, loadData, paragraphs } from './ui.js';

const KEYS = ['steady', 'order', 'calm'];
const START = Date.UTC(2026, 7, 10); // 2026-08-10 월요일, 첫 주의 시작

function renderHero(records, story) {
  const nums = $('#nums');
  const facts = [
    [`${records.counts.days}일`, '아침·마무리 기록'],
    [`${records.counts.peerLines}줄`, '동료가 말해 준 내 장점'],
    [`${story.strengths.items.length}개`, '되풀이된 강점'],
  ];
  nums.append(...facts.map(([b, s]) => el('div', {}, el('b', { text: b }), el('span', { text: s }))));
}

function renderDays(records, story) {
  const wrap = $('#days');
  const grid = $('#days-grid');
  const detail = $('#day-detail');
  const byKey = Object.fromEntries(story.strengths.items.map((s) => [s.key, s]));
  const info = new Map(perDay(records, KEYS).map((d) => [d.date, d]));
  const recByDate = new Map(records.days.map((d) => [d.date, d]));

  ['월', '화', '수', '목', '금'].forEach((w, i) => {
    const n = el('span', { class: 'days__wd', text: i % 2 === 0 ? w : '', 'aria-hidden': 'true' });
    n.style.gridRow = String(i + 2);
    n.style.gridColumn = '1';
    grid.append(n);
  });

  let lastMonth = -1;
  const cells = [];
  for (let week = 0; week < 12; week += 1) {
    for (let wd = 0; wd < 5; wd += 1) {
      const t = START + (week * 7 + wd) * 86400000;
      const iso = new Date(t).toISOString().slice(0, 10);
      if (iso < '2026-08-11' || iso > '2026-10-30') continue;
      const month = new Date(t).getUTCMonth();
      if (wd === 0 || iso === '2026-08-11') {
        if (month !== lastMonth) {
          const m = el('span', { class: 'days__mo', text: `${month + 1}월`, 'aria-hidden': 'true' });
          m.style.gridColumn = String(week + 2);
          grid.append(m);
          lastMonth = month;
        }
      }
      const d = info.get(iso);
      const cell = el('button', {
        type: 'button',
        class: 'cell',
        'data-k': d ? d.k : null,
        'data-w': d ? String(d.w) : null,
        'data-setback': d?.setback || null,
        'data-miss': d ? null : true,
        'aria-pressed': d ? 'false' : null,
        'aria-label': d
          ? `${fmtDate(iso)}, ${d.k === 'none' ? '세 강점과 겹치는 동료 말 없음' : `${byKey[d.k]?.name ?? ''} ${d.w}줄`}${d.setback ? ', 실천하지 못한 날' : ''}`
          : `${fmtDate(iso)}, 기록 없음`,
        disabled: d ? null : true,
      });
      cell.style.gridRow = String(wd + 2);
      cell.style.gridColumn = String(week + 2);
      if (d) {
        cell.addEventListener('click', () => select(iso, cell));
        cells.push(cell);
      }
      grid.append(cell);
    }
  }

  const LABEL = { scene: '장면', episode: '일화', peer: '동료가 본 나', kept: '실천', effort: '노력', note: '나에게' };
  function select(iso, cell) {
    cells.forEach((c) => c.setAttribute('aria-pressed', String(c === cell)));
    const day = recByDate.get(iso);
    const pick = day.items.filter((i) => LABEL[i.kind]).slice(0, 7);
    detail.replaceChildren(
      el('h3', { text: fmtDate(iso) }),
      el('ul', {}, ...pick.map((i) => el('li', {}, el('span', { text: LABEL[i.kind] }), i.text))),
    );
  }

  const legend = $('#days-legend');
  for (const k of KEYS) {
    const b = el('button', { type: 'button', 'aria-pressed': 'false' }, el('i', { class: `dot dot--${k}` }), byKey[k].short);
    b.addEventListener('click', () => {
      const on = wrap.dataset.focus === k;
      if (on) delete wrap.dataset.focus;
      else wrap.dataset.focus = k;
      legend.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b && !on)));
    });
    legend.append(b);
  }
  legend.append(el('span', { class: 'setback' }, el('i'), '실천하지 못한 날'));
  const first = cells.find((c) => c.hasAttribute('data-setback'));
  if (first) first.click();
}

function renderStrengths(story) {
  const s = story.strengths;
  $('#str-method').textContent = s.method;
  $('#str-list').append(
    ...s.items.map((it) =>
      el(
        'article',
        { class: 'str__item', 'data-k': it.key, id: `s-${it.key}` },
        el(
          'div',
          { class: 'str__body' },
          el('div', { class: 'str__top' }, el('h3', { text: it.name }), el('span', { class: 'str__count', text: it.count })),
          el(
            'dl',
            { class: 'str__facts' },
            el('div', {}, el('dt', { text: '날짜 있는 장면' }), el('dd', {}, it.scene.text, el('time', { datetime: it.scene.date, text: fmtDate(it.scene.date) }))),
            el('div', {}, el('dt', { text: '동료가 말한 것' }), ...it.peer.map((p) => el('dd', {}, el('q', { text: p.text }), el('time', { datetime: p.date, text: fmtDate(p.date) })))),
            el('div', {}, el('dt', { text: '그때 지킨 가치' }), el('dd', {}, it.value.text, el('time', { datetime: it.value.date, text: fmtDate(it.value.date) }))),
            el('div', {}, el('dt', { text: '이어진 과제' }), ...it.work.map((w) => el('dd', {}, el('span', { class: 'task', text: w.task }), el('a', { href: w.url, text: w.name }), el('br'), w.what))),
          ),
          el('p', { class: 'str__note' }, el('b', { text: '짚어 둘 점 ' }), it.critique),
        ),
      ),
    ),
  );
  $('#cut-list').append(
    ...s.removed.map((r) => el('li', {}, el('s', { text: r.name }), el('small', { text: `${r.count} · ${r.confirmed ? '직접 확정' : '에이전트 제안'}` }), el('p', { text: r.reason }))),
  );
  if (s.removedByMe.status !== 'done') $('#cut-todo').textContent = s.removedByMe.note;
}

function renderStory(story, reviewCount) {
  const st = story.story;
  $('#hardship').textContent = st.hardship.text || st.hardship.prompt;
  $('#third').append(...paragraphs(st.thirdPerson.text));
  $('#third-pill').replaceWith(pill(st.thirdPerson.status));
  if (st.firstPerson.text) $('#first').replaceChildren(...paragraphs(st.firstPerson.text));
  else $('#first-todo').textContent = st.firstPerson.note;
  $('#first-pill').replaceWith(pill(st.firstPerson.status));
  $('#review-count').textContent = reviewCount == null ? '동료 평가를 불러오지 못했습니다.' : `지금까지 남겨진 동료 평가 ${reviewCount}개 · 두 개 이상이면 C13 통과`;
}

function renderLetter(story) {
  const c = story.coverLetter;
  $('#first-line').textContent = c.firstLine.text || '첫 문장은 직접 씁니다. 읽는 사람이 가장 오래 기억하는 자리입니다.';
  $('#letter-body').append(...paragraphs(c.body));
  $('#last-line').textContent = c.lastLine.text || '마지막 문장도 직접 씁니다.';
  $('#letter-meta').textContent = `본문 ${c.body.replace(/\s/g, '').length}자(공백 제외). ${c.note}`;

  const cols = story.strengths.items.map((s) =>
    el('section', { class: 'panel' }, el('h3', {}, el('i', { class: `dot dot--${s.key}` }), s.name), el('ul', {}, ...s.work.map((w) => el('li', {}, el('span', { class: 'task', text: w.task }), el('a', { href: w.url, text: w.name }), el('br'), w.what)))),
  );
  cols.push(el('section', { class: 'panel' }, el('h3', { text: '아직 자리를 못 정한 과제' }), el('ul', {}, ...story.portfolio.unplaced.map((w) => el('li', {}, el('span', { class: 'task', text: w.task }), el('a', { href: w.url, text: w.name }))))));
  $('#folio').append(...cols);
  $('#folio-note').textContent = story.portfolio.note;
}

function renderRules(story) {
  $('#rules').append(...RULES.map((r) => el('li', {}, el('b', { text: r.title }), el('span', { text: r.body }))));
  $('#prio').textContent = PRIORITY;
  $('#picks').append(...story.passages.items.map((p) => el('li', {}, el('time', { datetime: p.date, text: `${fmtDate(p.date)} · ${p.tag}` }), el('blockquote', { text: p.text }), el('p', { text: p.why }))));
  $('#picks-note').textContent = story.passages.note;
}

function renderCheck(story, reviewCount) {
  const crit = story.criteria.map((c) => (c.id === 'T09-C13' && reviewCount >= 2 ? { ...c, status: 'done' } : c));
  const n = { done: 0, draft: 0, todo: 0 };
  crit.forEach((c) => (n[c.status] += 1));
  const bar = $('#progress-bar');
  const a = el('i');
  const b = el('i');
  a.style.width = `${(n.done / crit.length) * 100}%`;
  b.style.width = `${(n.draft / crit.length) * 100}%`;
  bar.append(a, b);
  $('#progress-n').textContent = `${n.done} / ${crit.length} 완료`;

  const row = (c) => el('li', {}, el('code', { text: c.id.replace('T09-', '') }), el('span', { text: c.text }), pill(c.status));
  $('#crit-open').append(...crit.filter((c) => c.status !== 'done').map(row));
  $('#crit-done').append(...crit.filter((c) => c.status === 'done').map(row));
  $('#crit-done-sum').textContent = `완료한 조건 ${n.done}개 보기`;

  const j = story.judgement;
  $('#judge').append(
    el('div', {}, el('dt', { text: 'AI에게 맡긴 일' }), el('dd', { text: j.aiDid })),
    el('div', {}, el('dt', { text: '내가 직접 판단한 일' }), el('dd', { text: j.iDecided })),
    el('div', {}, el('dt', { text: 'AI 제안을 따르지 않은 일' }), el('dd', { text: j.iRejected.text || '아직 비어 있습니다. 없었다면 왜 없었는지를 적습니다.' })),
  );
  const v = story.verify;
  $('#verify').append(
    ...[['어디서', v.where], ['무엇을', v.steps], ['통과', v.pass], ['실패', v.fail]].map(([t, d]) => el('div', {}, el('dt', { text: t }), el('dd', { text: d }))),
  );
}

async function main() {
  const { records, story } = await loadData();
  const reviewCount = await getJSON('/api/reviews').then((r) => r.items.length).catch(() => null);
  renderHero(records, story);
  renderDays(records, story);
  renderStrengths(story);
  renderStory(story, reviewCount);
  renderLetter(story);
  renderRules(story);
  renderCheck(story, reviewCount ?? 0);
}

main().catch((err) => {
  $('#main').prepend(el('p', { class: 'notice', text: `기록 파일을 읽지 못했습니다(${err.message}). 서사 문서 T09-narrative.md를 확인해 주세요.` }));
});
