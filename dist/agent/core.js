// 나를 말하는 에이전트 · 핵심 모듈
// 프레임워크에 묶이지 않은 순수 ES 모듈이다. 브라우저(이 페이지)와 Node(api/ask.js, 검사 스크립트)가
// 같은 파일을 쓴다. 나중에 introme 챗봇으로 옮길 때도 이 파일과 data/*.json만 가져가면 된다.

/** 에이전트 규칙 다섯 개와 부딪칠 때의 우선순위. 순서가 곧 우선순위다. */
export const RULES = [
  {
    id: 1,
    title: '형용사 대신 장면으로 말한다',
    body: '"성실하다" 같은 말은 혼자 쓰지 않는다. 형용사 하나에는 날짜가 붙은 장면 하나를 반드시 붙인다. 장면이 없으면 그 형용사는 지운다.',
  },
  {
    id: 2,
    title: '내가 본 나와 남이 본 나를 나란히 세운다',
    body: '강점마다 내가 쓴 기록 한 줄과 동료가 말해 준 한 줄을 같이 놓는다. 동료의 말은 주장이 아니라 증거로만 쓴다. 동료 말이 없으면 "자신의 느낌"이라고 밝힌다.',
  },
  {
    id: 3,
    title: '한 번 나온 칭찬은 후보, 되풀이된 것만 강점',
    body: '하루 나온 말은 후보 목록에만 올린다. 서로 다른 날에 여러 번 나온 것만 강점으로 올리고, 몇 번·며칠이었는지 숫자로 적는다.',
  },
  {
    id: 4,
    title: '먼저 3인칭으로 쓴다',
    body: '이야기 초안은 "주회 님은…"으로 시작하는 3인칭으로 쓴다. 남의 이야기처럼 읽어야 과장과 빈 곳이 보인다. 1인칭으로 바꾸는 일은 내가 한다.',
  },
  {
    id: 5,
    title: '기록이 없어도 서사는 이어지게 채운다',
    body: '기록이 비는 시점이나 사건 사이가 끊기면 흐름이 이어지게 채운다. 대신 채운 문장은 [채움]으로 표시해 내가 고르거나 지울 수 있게 한다.',
  },
];

export const PRIORITY =
  '규칙이 부딪치면 ① 장면 > ② 나와 남 > ③ 반복 > ④ 3인칭 > ⑤ 채움 순서로 따른다. 장면 없는 문장을 살리려고 빈 곳을 채우지 않는다.';

/** 강점 후보 사전. 패턴은 기록을 세기 위한 것이고, 강점을 정하는 일은 사람이 한다. */
export const LEXICON = [
  { key: 'steady', name: '매일 같은 자리에 먼저 와 있는 꾸준함', pattern: /일찍|지각|제시간|늦지|성실|부지런|먼저 와|가장 먼저|빨리 오|자리를? 지|같은 시간|루틴|꾸준/ },
  { key: 'order', name: '흩어진 것을 정리해 남기고 나누는 힘', pattern: /정리|정돈|깔끔|단정|기록|메모|폴더|파일 이름|공유|알려|설명|요약/ },
  { key: 'calm', name: '흔들려도 내 페이스로 돌아오는 침착함', pattern: /침착|차분|페이스|템포|평온|조급|흐트러|일정해|회복|다시 돌아|에너지|체력/ },
  { key: 'bright', name: '먼저 밝게 인사하는 태도', pattern: /밝|웃|인사|화사|긍정|사근/ },
  { key: 'listen', name: '끝까지 들어 주는 경청', pattern: /들어주|경청|공감|호응|리액션|헤아|끊고|끝까지 들/ },
];

const JOSA = /(은|는|이|가|을|를|에|의|와|과|도|로|으로|에서|에게|께|한테|부터|까지|만|요|야|죠|나요|까요|인가요|이에요|예요|했던|했나|하나)$/;
const STOP = new Set(['나', '내', '저', '제', '나의', '내가', '뭐', '무엇', '어떤', '어떻게', '알려줘', '말해줘', '있어', '있나', '했어', '좀', '그', '그때', '때']);

export function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(JOSA, ''))
    .filter((w) => w.length > 0 && !STOP.has(w));
}

function bigrams(word) {
  if (word.length < 2) return [word];
  const out = [];
  for (let i = 0; i < word.length - 1; i += 1) out.push(word.slice(i, i + 2));
  return out;
}

/** 모든 기록 줄을 평평하게 편다. */
export function flatten(records) {
  const rows = [];
  for (const day of records.days) {
    for (const item of day.items) rows.push({ date: day.date, ...item });
  }
  return rows;
}

const KIND_WEIGHT = { episode: 1.4, peer: 1.3, learned: 1.2, effort: 1.1, note: 1, kept: 1, strength: 0.9, value: 0.8, action: 0.8, scene: 0.7, thanks: 0.7, diary: 0.7 };

/** 질문과 기록 줄의 겹침 점수. 바이그램 기반이라 조사·어미 변화에 덜 흔들린다. */
export function search(records, query, limit = 6) {
  const qGrams = new Set(tokens(query).flatMap(bigrams));
  if (qGrams.size === 0) return [];
  return flatten(records)
    .map((row) => {
      const grams = new Set(tokens(row.text).flatMap(bigrams));
      let hit = 0;
      for (const g of qGrams) if (grams.has(g)) hit += 1;
      return { row, hit, score: (hit / qGrams.size) * (KIND_WEIGHT[row.kind] ?? 1) };
    })
    // 우연히 한 글자쌍만 겹친 줄은 근거로 쓰지 않는다. 엉뚱한 근거보다 '없음'이 낫다.
    .filter((r) => r.hit >= 2 && r.score > 0.2)
    .sort((a, b) => b.score - a.score || a.row.date.localeCompare(b.row.date))
    .slice(0, limit)
    .map((r) => r.row);
}

/** 강점 후보를 세어 표로 돌려준다. 동료 말과 내 기록을 따로 센다(규칙 ②·③). */
export function tally(records) {
  const rows = flatten(records);
  return LEXICON.map((cat) => {
    const peer = rows.filter((r) => r.kind === 'peer' && cat.pattern.test(r.text));
    const self = rows.filter((r) => r.source === 'self' && ['strength', 'episode', 'learned', 'value', 'effort'].includes(r.kind) && cat.pattern.test(r.text));
    const days = new Set([...peer, ...self].map((r) => r.date));
    return { key: cat.key, name: cat.name, peerCount: peer.length, selfCount: self.length, dayCount: days.size, peer, self };
  }).sort((a, b) => b.dayCount - a.dayCount);
}

/** 실천하지 못한 날과 그 다음 기록. 고비 이야기의 재료다. */
export function setbacks(records) {
  const out = [];
  records.days.forEach((day, i) => {
    const kept = day.items.find((it) => it.kind === 'kept');
    if (kept && /못/.test(kept.text)) {
      const effort = day.items.find((it) => it.kind === 'effort');
      const next = records.days[i + 1];
      out.push({
        date: day.date,
        effort: effort?.text ?? '',
        next: next ? { date: next.date, action: next.items.find((it) => it.kind === 'action')?.text ?? '' } : null,
      });
    }
  });
  return out;
}

const INTENTS = [
  { key: 'strength', test: /강점|장점|잘하|잘 하|어떤 사람|성향|특징/ },
  { key: 'setback', test: /고비|힘들|못 했|못했|실패|어려|지쳤|기빨|기가 빨/ },
  { key: 'peer', test: /동료|팀원|남들|다른 사람.*(말|평가|보)|평가/ },
  { key: 'rules', test: /규칙|원칙|어떻게 (답|판단)|기준/ },
];

function cite(row) {
  return { date: row.date, label: row.label, text: row.text };
}

/**
 * 질문에 기록만으로 답한다. 외부 AI 없이 동작하는 기본 모드.
 * @returns {{ mode: 'local', answer: string, citations: Array<{date:string,label:string,text:string}> }}
 */
export function answerLocal(records, story, query) {
  const intent = INTENTS.find((i) => i.test.test(query))?.key;

  if (intent === 'rules') {
    return {
      mode: 'local',
      answer: `이 에이전트는 규칙 다섯 개로 답합니다. ${RULES.map((r) => `${'①②③④⑤'[r.id - 1]} ${r.title}`).join(' · ')}. ${PRIORITY}`,
      citations: [],
    };
  }

  if (intent === 'setback') {
    const s = setbacks(records)[0];
    const rows = search(records, `${query} 에너지 체력 기빨 회복 다시`, 4);
    const lead = s
      ? `기록에서 "못 했다"고 적힌 날은 ${s.date} 하루뿐입니다. 그날 주회 님은 "${s.effort}"라고 적었고, 다음 기록일(${s.next?.date})의 첫 행동은 "${s.next?.action}"였습니다. 쓰러진 날 바로 다음 계획에 '에너지 분배'를 넣은 것이 이 기록의 고비이자 전환점입니다.`
      : '기록에는 실천하지 못했다고 적힌 날이 없습니다.';
    const cites = s ? [{ date: s.date, label: '노력하고 생각한 것', text: s.effort }, ...rows.map(cite)] : rows.map(cite);
    return { mode: 'local', answer: lead, citations: dedupe(cites).slice(0, 5) };
  }

  const focus = LEXICON.find((c) => c.pattern.test(query));
  if ((intent === 'strength' || intent === 'peer') && focus) {
    const c = tally(records).find((t) => t.key === focus.key);
    const cites = dedupe([...c.peer.slice(0, 3), ...c.self.filter((r) => r.kind === 'episode' || r.kind === 'effort').slice(0, 2)].map(cite));
    return {
      mode: 'local',
      answer: `"${c.name}" 쪽 기록입니다. 동료가 ${c.peerCount}줄, 내가 ${c.selfCount}줄 남겼고 서로 다른 ${c.dayCount}일에 나옵니다. 근거 원문은 아래와 같습니다.`,
      citations: cites,
    };
  }

  if (intent === 'strength' || intent === 'peer') {
    const confirmed = story?.strengths?.items ?? [];
    const t = tally(records);
    const top = t.slice(0, 3);
    const head = confirmed.length
      ? `강점 지도에 오른 세 가지는 ${confirmed.map((s) => `"${s.name}"`).join(', ')}입니다.`
      : '';
    const counts = top.map((c) => `${c.name}(동료 말 ${c.peerCount}줄, ${c.dayCount}일)`).join(' · ');
    const peerFirst = intent === 'peer';
    const cites = top.flatMap((c) => (peerFirst ? c.peer.slice(0, 2) : [c.peer[0], c.self[0]].filter(Boolean))).map(cite);
    return {
      mode: 'local',
      answer: `${head} 기록을 세어 보면 서로 다른 날에 가장 많이 되풀이된 것은 ${counts}입니다. 숫자는 표현이 겹치는 줄을 센 것이라 정확한 집계가 아니라 방향을 보는 용도입니다.`.trim(),
      citations: dedupe(cites).slice(0, 6),
    };
  }

  // 질문이 강점 후보 하나를 가리키면(예: "정리", "침착") 그 후보에 맞는 줄 안에서만 찾는다.
  const cat = LEXICON.find((c) => c.pattern.test(query));
  const scoped = cat
    ? { days: records.days.map((d) => ({ ...d, items: d.items.filter((i) => cat.pattern.test(i.text)) })) }
    : records;
  let rows = search(scoped, query, 5);
  if (cat && rows.length < 3) {
    const extra = flatten(scoped).filter((r) => r.kind === 'peer' || r.kind === 'episode' || r.kind === 'effort');
    rows = dedupe([...rows, ...extra].map(cite)).slice(0, 5);
  }
  if (rows.length === 0) {
    return {
      mode: 'local',
      answer: '이 질문과 겹치는 기록을 찾지 못했습니다. 기록에 없는 내용은 지어내지 않습니다. 강점, 고비, 동료가 본 모습, 특정 날짜(예: 9월 8일)로 물어보세요.',
      citations: [],
    };
  }
  return {
    mode: 'local',
    answer: `기록에서 가장 가까운 대목 ${rows.length}개를 찾았습니다. 아래 날짜의 원문이 근거입니다.`,
    citations: rows.map(cite),
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((c) => {
    const k = `${c.date}|${c.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 날짜로 묻는 경우(예: "9월 8일", "2026-09-08")를 먼저 처리한다. */
export function byDate(records, query) {
  const m = query.match(/(\d{4})-(\d{2})-(\d{2})/) || query.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!m) return null;
  const date = m.length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const day = records.days.find((d) => d.date === date);
  if (!day) return { mode: 'local', answer: `${date}에는 리추얼 기록이 없습니다(주말·휴일이거나 결석).`, citations: [] };
  const pick = day.items.filter((i) => ['episode', 'peer', 'kept', 'effort', 'note'].includes(i.kind));
  return { mode: 'local', answer: `${date}의 기록입니다.`, citations: pick.map((r) => cite({ date, ...r })) };
}

export function answer(records, story, query) {
  return byDate(records, query) ?? answerLocal(records, story, query);
}

/** 외부 AI 모드에 넘길 시스템 프롬프트. 규칙과 근거 기록만 담는다. */
export function systemPrompt(story) {
  return [
    '너는 권주회의 리추얼 기록만을 근거로 그 사람의 강점과 이야기를 답하는 에이전트다.',
    '아래 규칙을 순서대로 지킨다.',
    ...RULES.map((r) => `${r.id}. ${r.title}: ${r.body}`),
    PRIORITY,
    '추가 제약: 동료의 이름이나 다른 사람의 실명은 쓰지 않는다. 근거로 쓴 기록은 날짜를 붙여 인용한다. 주어진 기록에 없는 경력·학력·수치는 지어내지 않는다. 한국어 존댓말로 답한다.',
    story?.strengths?.items?.length
      ? `본인이 확정한 강점 세트: ${story.strengths.items.map((s) => s.name).join(' / ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function contextFor(records, query, limit = 14) {
  const rows = search(records, query, limit);
  const extra = tally(records).slice(0, 3).flatMap((c) => c.peer.slice(0, 2));
  return dedupe([...rows, ...extra].map(cite))
    .slice(0, limit)
    .map((c) => `[${c.date} · ${c.label}] ${c.text}`)
    .join('\n');
}
