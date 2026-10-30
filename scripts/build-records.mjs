// 9번 과제 화면에서 내려받은 리추얼 JSON을 에이전트가 읽는 기록으로 바꾼다.
// 사용법: node scripts/build-records.mjs private/ritual-history-YYYY-MM-DD.json
//
// 원본 파일은 private/ 아래에만 두고 커밋하지 않는다(.gitignore).
// 공개 기록에는 "나"에 관한 칸만 남긴다.
//  - 남김: 장면, 내 강점, 일화, 알게 된 점, 동료가 말해 준 내 장점, 오늘 지킬 가치,
//          첫 행동, 강점 행동(실천 여부), 노력, 나에게 남기는 말, 내가 나눈 감사, 감사일기
//  - 버림: 호흡 시간, 내가 동료에게 말한 장점(동료에 관한 글), 동료가 나눈 감사(동료의 글)
import { readFile, writeFile } from 'node:fs/promises';

const src = process.argv[2];
if (!src) {
  console.error('원본 JSON 경로가 필요합니다. 예: node scripts/build-records.mjs private/ritual-history-2026-10-30.json');
  process.exit(1);
}

const raw = JSON.parse(await readFile(src, 'utf8'));

// 라벨 → 공개 기록의 종류. 목록에 없는 라벨은 버린다(허용 목록 방식).
const KEEP = [
  [/^(편안했던|덜 힘들었던) 장면$/, 'scene', 'self'],
  [/^내 강점$/, 'strength', 'self'],
  [/^강점이 드러난 일화$/, 'episode', 'self'],
  [/^그 결과·알게 된 점$/, 'learned', 'self'],
  [/^동료 \d가 말해 준 내 장점$/, 'peer', 'peer'],
  [/^오늘 지킬 강점·가치$/, 'value', 'self'],
  [/^오늘의 첫 행동$/, 'action', 'self'],
  [/^강점 행동$/, 'kept', 'self'],
  [/^강점을 위해 노력하고 생각한 것$/, 'effort', 'self'],
  [/^나에게 남기는 말$/, 'note', 'self'],
  [/^내가 나눈 감사$/, 'thanks', 'self'],
  [/^감사일기$/, 'diary', 'self'],
];

const LABEL = {
  scene: '편안했던 장면', strength: '내 강점', episode: '강점이 드러난 일화', learned: '알게 된 점',
  peer: '동료가 말해 준 내 장점', value: '오늘 지킬 가치', action: '오늘의 첫 행동', kept: '강점 행동',
  effort: '노력하고 생각한 것', note: '나에게 남기는 말', thanks: '내가 나눈 감사', diary: '감사일기',
};

function clean(text) {
  return text
    .replace(/\s+—\s+\(이름 가림\)\s*$/, '') // 감사일기 끝의 작성자 표기
    .replace(/^>\s*/, '')
    .trim();
}

const days = raw.days.map((day) => {
  const items = [];
  for (const [part, lines] of [['open', day.open], ['close', day.close]]) {
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      const idx = line.indexOf(': ');
      if (idx < 0) continue;
      const label = line.slice(0, idx).trim();
      const text = clean(line.slice(idx + 2));
      const rule = KEEP.find(([re]) => re.test(label));
      if (!rule || !text) continue;
      const [, kind, source] = rule;
      items.push({ part, kind, source, label: LABEL[kind], text });
    }
  }
  return { date: day.date, closed: Array.isArray(day.close), items };
});

const out = {
  owner: '권주회',
  exportedFrom: '9번 과제 화면 · JSON으로 담기',
  generatedAt: new Date().toISOString().slice(0, 10),
  privacy: '동료 이름은 내보내기 단계에서 가려졌고, 동료에 관한 글과 동료가 쓴 감사는 공개 기록에서 제외했다.',
  counts: {
    days: days.length,
    open: raw.days.filter((d) => Array.isArray(d.open)).length,
    close: days.filter((d) => d.closed).length,
    peerLines: days.reduce((n, d) => n + d.items.filter((i) => i.kind === 'peer').length, 0),
  },
  days,
};

// 마지막 안전 검사: 버리기로 한 칸이 남아 있으면 실패시킨다.
const leaked = JSON.stringify(out).match(/동료 \d에게 말한|동료 \d가 나눈 감사|호흡:/);
if (leaked) {
  console.error('제외해야 할 칸이 남아 있습니다:', leaked[0]);
  process.exit(1);
}

await writeFile('dist/data/records.json', JSON.stringify(out, null, 1) + '\n');
console.log(`records.json: ${out.counts.days}일, 아침 ${out.counts.open} · 마무리 ${out.counts.close}, 동료가 말해 준 장점 ${out.counts.peerLines}줄`);
