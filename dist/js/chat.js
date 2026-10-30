// 대화 페이지: 이 브라우저에 저장되는 대화 + 공개로 남기는 대화
import { answer } from '../agent/core.js';
import { $, el, fmtDate, fmtTime, getJSON, loadData, store, toast } from './ui.js';

const KEY = 'storyme.chat.v1';
const SUGGEST = ['내 강점이 뭐야?', '가장 힘들었던 날은?', '동료들은 나를 어떻게 봐?', '정리를 잘한 장면을 보여줘', '9월 8일에 무슨 일이 있었어?', '에이전트 규칙이 뭐야?'];

const msgs = $('#msgs');
const input = $('#composer-input');
const form = $('#composer');
const saveBtn = $('#save-chat');
const readonly = $('#readonly');

let data;
let useAi = false;
let turns = store.get(KEY, []); // [{q, answer, citations, mode}]
let viewing = null; // 남겨진 대화를 보는 중이면 그 id

function botMessage(t) {
  const box = el('div', { class: 'msg msg--bot' }, el('div', { class: 'who' }, el('span', { class: 'mark__dots', 'aria-hidden': 'true' }, ...Array.from({ length: 9 }, () => el('i'))), t.mode === 'ai' ? '에이전트 · AI 답변' : '에이전트'), el('p', { text: t.answer }));
  if (t.citations?.length) {
    box.append(el('ul', { class: 'cites', 'aria-label': '근거 기록' }, ...t.citations.map((c) => el('li', {}, el('time', { datetime: c.date, text: `${fmtDate(c.date)} · ${c.label}` }), c.text))));
  }
  return box;
}

function render(list) {
  if (list.length === 0) {
    msgs.replaceChildren(
      el('div', { class: 'empty' }, el('h2', { text: '무엇이든 기록에 물어보세요' }), el('p', { text: '53일의 아침·마무리 기록에서 날짜가 붙은 원문을 찾아 답합니다. 왼쪽 예시로 시작해도 좋습니다.' })),
    );
  } else {
    msgs.replaceChildren(...list.flatMap((t) => [el('div', { class: 'msg msg--me', text: t.q }), botMessage(t)]));
    msgs.scrollTop = msgs.scrollHeight;
  }
  saveBtn.disabled = viewing !== null || turns.length === 0;
}

async function ask(q) {
  q = q.trim();
  if (!q || !data) return;
  if (viewing) exitViewing();
  let res = null;
  if (useAi) {
    try {
      res = await getJSON('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) });
    } catch {
      res = null;
    }
  }
  res ??= answer(data.records, data.story, q);
  turns.push({ q, answer: res.answer, citations: res.citations, mode: res.mode });
  turns = turns.slice(-40);
  store.set(KEY, turns);
  render(turns);
}

function exitViewing() {
  viewing = null;
  readonly.hidden = true;
  document.querySelectorAll('.saved button').forEach((b) => b.removeAttribute('aria-current'));
  render(turns);
}

async function openSaved(id, button) {
  try {
    const { item } = await getJSON(`/api/chats?id=${encodeURIComponent(id)}`);
    viewing = id;
    document.querySelectorAll('.saved button').forEach((b) => b.toggleAttribute('aria-current', b === button));
    readonly.hidden = false;
    readonly.replaceChildren(el('span', { text: `${fmtTime(item.createdAt)}에 남겨진 대화를 보는 중입니다.` }), el('button', { type: 'button', text: '내 대화로 돌아가기', onclick: exitViewing }));
    render(item.turns);
  } catch (err) {
    toast(err.message);
  }
}

async function loadSaved() {
  const list = $('#saved');
  try {
    const { items } = await getJSON('/api/chats');
    if (items.length === 0) {
      list.replaceChildren(el('li', { class: 'saved__empty', text: '아직 남겨진 대화가 없습니다.' }));
      return;
    }
    list.replaceChildren(
      ...items.map((it) => {
        const b = el('button', { type: 'button' }, el('b', { text: it.title }), el('small', { text: `${fmtTime(it.createdAt)} · 질문 ${it.count}개` }));
        b.addEventListener('click', () => openSaved(it.id, b));
        return el('li', {}, b);
      }),
    );
  } catch {
    list.replaceChildren(el('li', { class: 'saved__empty', text: '남겨진 대화를 불러오지 못했습니다.' }));
  }
}

saveBtn.addEventListener('click', async () => {
  if (turns.length === 0) return;
  saveBtn.disabled = true;
  try {
    await getJSON('/api/chats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ questions: turns.map((t) => t.q) }) });
    toast('대화를 남겼습니다');
    await loadSaved();
  } catch (err) {
    toast(err.message);
  } finally {
    saveBtn.disabled = turns.length === 0;
  }
});

$('#new-chat').addEventListener('click', () => {
  turns = [];
  store.set(KEY, turns);
  if (viewing) exitViewing();
  else render(turns);
  input.focus();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value;
  input.value = '';
  ask(q);
});

$('#suggest').append(...SUGGEST.map((q) => el('button', { type: 'button', text: q, onclick: () => ask(q) })));

getJSON('/api/ask')
  .then((r) => {
    useAi = r.enabled === true;
    if (useAi) $('#mode').textContent = 'AI 답변 · 기록에서 찾은 원문만 근거로 씁니다';
  })
  .catch(() => {});

loadData()
  .then((d) => {
    data = d;
    render(turns);
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      history.replaceState(null, '', location.pathname);
      ask(q);
    }
  })
  .catch((err) => msgs.replaceChildren(el('p', { class: 'notice', text: `기록 파일을 읽지 못했습니다(${err.message}).` })));
loadSaved();
