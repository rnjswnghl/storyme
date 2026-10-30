// 에이전트 엔진 동작 확인. node scripts/agent-check.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as A from '../dist/agent/core.js';

const records = JSON.parse(await readFile(new URL('../dist/data/records.json', import.meta.url), 'utf8'));
const story = JSON.parse(await readFile(new URL('../dist/data/story.json', import.meta.url), 'utf8'));

console.log('강점 후보 집계 (동료 말 / 내 기록 / 서로 다른 날)');
for (const c of A.tally(records)) console.log(`  ${c.name}: ${c.peerCount} / ${c.selfCount} / ${c.dayCount}일`);

const s = A.setbacks(records);
assert.equal(s.length, 1, '"못 했다" 기록은 하루');
assert.equal(s[0].date, '2026-08-14');

const cases = [
  ['내 강점이 뭐야?', (a) => a.citations.length >= 3],
  ['가장 힘들었던 날은?', (a) => a.answer.includes('2026-08-14')],
  ['동료들은 나를 어떻게 봐?', (a) => a.citations.some((c) => c.label.startsWith('동료'))],
  ['컴퓨터 포맷했던 일', (a) => a.citations.some((c) => c.date === '2026-09-08')],
  ['9월 8일', (a) => a.citations.length > 0 && a.citations.every((c) => c.date === '2026-09-08')],
  ['에이전트 규칙이 뭐야?', (a) => a.answer.includes('장면')],
  ['희망 연봉 얼마야', (a) => a.citations.length === 0],
];
let pass = 0;
for (const [q, ok] of cases) {
  const a = A.answer(records, story, q);
  const good = ok(a);
  pass += good ? 1 : 0;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${q} → ${a.answer.slice(0, 70)}… (근거 ${a.citations.length})`);
}
console.log(`${pass}/${cases.length}`);
if (pass !== cases.length) process.exit(1);
