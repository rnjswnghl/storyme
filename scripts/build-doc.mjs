// story.json + 규칙 → 제출용 서사 문서(MD) 한 개.
// 결과: docs/T09-narrative.md 와 같은 내용의 dist/T09-narrative.md(웹에서 내려받기용)
import { readFile, writeFile } from 'node:fs/promises';
import { RULES, PRIORITY, tally } from '../dist/agent/core.js';

const story = JSON.parse(await readFile(new URL('../dist/data/story.json', import.meta.url), 'utf8'));
const records = JSON.parse(await readFile(new URL('../dist/data/records.json', import.meta.url), 'utf8'));
const SITE = process.env.SITE_URL || 'https://storyme-t09.vercel.app';
const S = { done: '완료', draft: '초안·검토 필요', todo: '본인 작성 필요' };
const tag = (s) => `\`${S[s] ?? s}\``;
const blank = (t, fallback) => (t && t.trim() ? t : `> ✍️ ${fallback}`);

const L = [];
const push = (...lines) => L.push(...lines);

push(
  `# ${story.meta.owner} · ${story.meta.title}`,
  '',
  `${story.meta.task}  `,
  `기록 기간: ${story.meta.period}  `,
  `문서 갱신: ${story.meta.updated} · 웹 페이지: ${SITE} · 소스: https://github.com/rnjswnghl/storyme`,
  '',
  '상태 표기: `완료` · `초안·검토 필요`(에이전트가 쓴 것) · `본인 작성 필요`',
  '',
  '---',
  '',
  `## 1. 기록에서 고른 대목 ${tag(story.passages.status)}`,
  '',
  story.passages.note,
  '',
);
for (const p of story.passages.items) push(`- **${p.date}** · ${p.tag} — "${p.text}"  `, `  ${p.why}`);

push('', `## 2. 에이전트 규칙 ${tag(story.rules.status)}`, '');
for (const r of RULES) push(`${r.id}. **${r.title}** — ${r.body}`);
push('', `**우선순위** · ${PRIORITY}`, '');

const s = story.strengths;
push(`## 3. 강점 지도 ${tag(s.status)}`, '', s.method, '', '| 후보 | 동료 말 | 내 기록 | 서로 다른 날 |', '|---|---:|---:|---:|');
for (const t of tally(records)) push(`| ${t.name} | ${t.peerCount} | ${t.selfCount} | ${t.dayCount} |`);
push('', '| 강점 | 날짜 있는 장면 | 동료가 말한 것 | 그때 지킨 가치 | 1~8번 과제 |', '|---|---|---|---|---|');
for (const it of s.items) {
  push(
    `| **${it.name}**<br>${it.count} | ${it.scene.date}<br>${it.scene.text} | ${it.peer.map((p) => `${p.date} "${p.text}"`).join('<br>')} | ${it.value.date}<br>${it.value.text} | ${it.work.map((w) => `${w.task} [${w.name}](${w.url}) — ${w.what}`).join('<br>')} |`,
  );
}
push('', '**비판 메모**', '');
for (const it of s.items) push(`- ${it.name}: ${it.critique}`);
push('', '**지운 항목과 이유**', '');
for (const r of s.removed) push(`- ~~${r.name}~~ (${r.count}) · ${r.confirmed ? '본인 확정' : '에이전트 제안, 본인 확정 전'} — ${r.reason}`);
push('', `${tag(s.removedByMe.status)} ${s.removedByMe.note}`, '');

const st = story.story;
push(
  '## 4. 나의 회복탄력성: 고난을 통해 더 나아진 나',
  '',
  `### 과정 이전의 고난 ${tag(st.hardship.status)}`,
  '',
  blank(st.hardship.text, st.hardship.prompt),
  '',
  `### 3인칭 초안 ${tag(st.thirdPerson.status)}`,
  '',
  '`[채움]`은 기록에 없어 흐름을 잇기 위해 에이전트가 채운 문장입니다(규칙 ⑤).',
  '',
  st.thirdPerson.text,
  '',
  `### 1인칭 완성본 ${tag(st.firstPerson.status)}`,
  '',
  blank(st.firstPerson.text, st.firstPerson.note),
  '',
  `### 동료 두 사람의 답 ${tag(st.peerAnswers.answers.some((a) => a.same) ? 'done' : 'todo')}`,
  '',
  `질문: ${st.peerAnswers.questions.map((q) => `"${q}"`).join(' / ')}`,
  '',
);
for (const a of st.peerAnswers.answers) push(`- ${a.who} — 나 같아? ${a.same || '(미기록)'} / 지어낸 느낌? ${a.made_up || '(미기록)'}`);

const c = story.coverLetter;
push(
  '',
  `## 5. 자기소개서 초안 ${tag(c.status)}`,
  '',
  blank(c.firstLine.text, '첫 문장 — 본인이 직접 씁니다.'),
  '',
  c.body,
  '',
  blank(c.lastLine.text, '마지막 문장 — 본인이 직접 씁니다.'),
  '',
  `_${c.note}_`,
  '',
  `## 6. 포트폴리오 뼈대 ${tag(story.portfolio.status)}`,
  '',
  `**${story.meta.owner}** · ${story.meta.role}`,
  '',
  story.portfolio.note,
  '',
);
for (const it of s.items) {
  push(`### ${it.name}`);
  for (const w of it.work) push(`- ${w.task} [${w.name}](${w.url}) — ${w.what}`);
  push('');
}
push('### 배치 미정');
for (const w of story.portfolio.unplaced) push(`- ${w.task} [${w.name}](${w.url})`);

const j = story.judgement;
push(
  '',
  '## 7. AI와 나의 판단',
  '',
  `1. **AI에게 맡긴 일** — ${j.aiDid}`,
  `2. **내가 직접 판단한 일** — ${j.iDecided}`,
  `3. **AI 제안을 따르지 않은 일** — ${j.iRejected.text || '✍️ 본인 작성 필요(없었다면 왜 없었는지)'}`,
  '',
  '## 8. 짧은 확인 방법',
  '',
  `- **위치**: ${story.verify.where}`,
  `- **행동**: ${story.verify.steps}`,
  `- **통과 모습**: ${story.verify.pass}`,
  `- **실패 모습**: ${story.verify.fail}`,
  '',
  '## 9. 통과 조건 점검',
  '',
  '| 조건 | 내용 | 상태 |',
  '|---|---|---|',
  ...story.criteria.map((x) => `| ${x.id} | ${x.text} | ${S[x.status]} |`),
  '',
);

const md = L.join('\n');
await writeFile(new URL('../docs/T09-narrative.md', import.meta.url), md);
await writeFile(new URL('../dist/T09-narrative.md', import.meta.url), md);
console.log(`T09-narrative.md ${md.length}자 작성`);
