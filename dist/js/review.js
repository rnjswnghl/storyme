// 동료 평가 페이지: 이야기 읽기 → 두 질문 + 댓글 → 공개 목록
import { $, el, fmtTime, getJSON, loadData, paragraphs, pill, toast } from './ui.js';

const LABEL = {
  same: { yes: '응, 나 같아', partly: '반쯤', no: '아니' },
  madeUp: { no: '없어', partly: '조금', yes: '있어' },
};
const VERSION = { first: '1인칭 완성본', third: '3인칭 초안' };

let story;
let version = 'third';
let ownerKey = null;
try {
  ownerKey = sessionStorage.getItem('storyme.owner');
} catch {
  ownerKey = null;
}

function showStory() {
  const st = story.story;
  const text = version === 'first' ? st.firstPerson.text : st.thirdPerson.text;
  $('#story-text').replaceChildren(...paragraphs(text));
  $('#story-pill').replaceChildren(pill(version === 'first' ? st.firstPerson.status : st.thirdPerson.status));
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === version)));
}

function stack(items, key, order) {
  const n = items.length || 1;
  const bar = el('div', { class: 'stack', role: 'img', 'aria-label': order.map((v) => `${LABEL[key][v]} ${items.filter((i) => i[key] === v).length}명`).join(', ') });
  for (const v of order) {
    const c = items.filter((i) => i[key] === v).length;
    if (!c) continue;
    const seg = el('i', { 'data-v': key === 'madeUp' ? { no: 'yes', partly: 'partly', yes: 'no' }[v] : v });
    seg.style.width = `${(c / n) * 100}%`;
    bar.append(seg);
  }
  return el('div', {}, bar, el('div', { class: 'stack__key' }, ...order.map((v) => el('span', { text: `${LABEL[key][v]} ${items.filter((i) => i[key] === v).length}` }))));
}

function commentCard(it) {
  const card = el(
    'article',
    { class: 'panel comment' },
    el('div', { class: 'comment__top' }, el('b', { text: it.alias }), el('time', { datetime: it.createdAt, text: fmtTime(it.createdAt) })),
    el(
      'dl',
      {},
      el('div', {}, el('dt', { text: `나 같아? · ${VERSION[it.version] ?? ''}` }), el('dd', {}, el('strong', { text: LABEL.same[it.same] }), it.sameNote ? ` — ${it.sameNote}` : '')),
      el('div', {}, el('dt', { text: '지어낸 느낌?' }), el('dd', {}, el('strong', { text: LABEL.madeUp[it.madeUp] }), it.madeUpNote ? ` — ${it.madeUpNote}` : '')),
    ),
    it.comment ? el('p', { text: it.comment }) : null,
  );
  if (ownerKey) {
    card.append(
      el('button', {
        type: 'button',
        class: 'del',
        text: '이 평가 지우기',
        onclick: async () => {
          if (!confirm('이 평가를 지울까요? 되돌릴 수 없습니다.')) return;
          try {
            await getJSON(`/api/reviews?id=${encodeURIComponent(it.id)}`, { method: 'DELETE', headers: { 'x-owner-key': ownerKey } });
            toast('평가를 지웠습니다');
            loadBoard();
          } catch (err) {
            toast(err.message);
          }
        },
      }),
    );
  }
  return card;
}

async function loadBoard() {
  try {
    const { items, ownerEnabled } = await getJSON('/api/reviews');
    $('#board-sum').textContent = items.length ? `${items.length}명이 답했습니다. 과제 조건은 두 사람 이상의 답입니다.` : '';
    if (items.length === 0) {
      $('#tallies').replaceChildren();
      $('#comments').replaceChildren(el('div', { class: 'panel board__empty', text: '아직 남겨진 평가가 없습니다. 첫 평가를 남겨 주세요.' }));
    } else {
      $('#tallies').replaceChildren(
        el('section', { class: 'panel' }, el('h3', { text: '나 같아?' }), stack(items, 'same', ['yes', 'partly', 'no'])),
        el('section', { class: 'panel' }, el('h3', { text: '지어낸 느낌이 있어?' }), stack(items, 'madeUp', ['no', 'partly', 'yes'])),
      );
      $('#comments').replaceChildren(...items.map(commentCard));
    }
    setupOwner(ownerEnabled);
  } catch (err) {
    $('#comments').replaceChildren(el('p', { class: 'notice', text: err.message }));
  }
}

// 주소 끝에 ?owner 를 붙여 열면 소유자 키 입력칸이 나온다. 키는 이 탭에만 기억한다.
function setupOwner(enabled) {
  if (!new URLSearchParams(location.search).has('owner') || ownerKey) return;
  const box = $('#owner');
  if (!enabled) {
    box.replaceChildren(el('p', { class: 'note-sm gap-top', text: '소유자 키(OWNER_KEY)가 아직 설정되지 않아 지우기를 쓸 수 없습니다.' }));
    return;
  }
  const input = el('input', { type: 'password', 'aria-label': '소유자 키', placeholder: '소유자 키' });
  box.replaceChildren(
    el('form', {
      class: 'gap-top',
      onsubmit: (e) => {
        e.preventDefault();
        ownerKey = input.value;
        try {
          sessionStorage.setItem('storyme.owner', ownerKey);
        } catch {
          /* 이번 페이지에서만 유지 */
        }
        box.replaceChildren();
        loadBoard();
      },
    }, input, ' ', el('button', { class: 'btn btn--ghost', type: 'submit', text: '관리 켜기' })),
  );
}

const form = $('#review-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const err = $('#form-err');
  if (!fd.get('same') || !fd.get('madeUp')) {
    err.textContent = '두 질문에 모두 답해 주세요.';
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  err.textContent = '';
  try {
    await getJSON('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...Object.fromEntries(fd), version }),
    });
    form.reset();
    toast('평가를 남겼습니다. 고맙습니다');
    loadBoard();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    button.disabled = false;
  }
});

loadData().then((d) => {
  story = d.story;
  const firstBtn = document.querySelector('.seg button[data-v="first"]');
  if (story.story.firstPerson.text) version = 'first';
  else {
    firstBtn.disabled = true;
    firstBtn.title = '아직 쓰지 않았습니다';
  }
  document.querySelectorAll('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      version = b.dataset.v;
      showStory();
    }),
  );
  showStory();
});
loadBoard();
