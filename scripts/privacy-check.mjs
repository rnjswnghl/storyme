// 공개 산출물에 들어가면 안 되는 것을 찾는다. node scripts/privacy-check.mjs
// - 동료에 관한 글/동료가 쓴 감사 칸, 호흡 기록
// - 원본 리추얼 파일이 공개 폴더에 섞였는지
// - 비밀값으로 보이는 패턴(API 키, 토큰, 개인키)
// - "OO님" 꼴의 이름(본인 이름 '주회'만 허용)
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['dist', 'docs', 'api', 'lib', 'scripts', 'README.md', 'vercel.json', 'package.json'];
const TEXT = /\.(js|mjs|json|md|html|css|svg|txt)$/;
const RULES = [
  [/동료 \d에게 말한 장점|동료 \d가 나눈 감사/, '동료에 관한 칸'],
  [/"호흡: /, '호흡 기록'],
  [/sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/, '비밀값 패턴'],
  [/ritual-history-\d{4}-\d{2}-\d{2}\.json"/, '원본 파일 직접 참조'],
];
const SELF = new Set(['주회']);
const SKIP = new Set(['scripts/privacy-check.mjs', 'scripts/build-records.mjs']);

async function* walk(p) {
  const s = await stat(p);
  if (s.isDirectory()) for (const f of await readdir(p)) yield* walk(path.join(p, f));
  else yield p;
}

let problems = 0;
let files = 0;
for (const r of ROOTS) {
  for await (const f of walk(r)) {
    if (!TEXT.test(f) || SKIP.has(f)) continue;
    files += 1;
    const text = await readFile(f, 'utf8');
    for (const [re, what] of RULES) {
      if (re.test(text)) {
        problems += 1;
        console.log(`FAIL ${f}: ${what}`);
      }
    }
    for (const m of text.matchAll(/([가-힣]{2})님/g)) {
      if (!SELF.has(m[1]) && !/^(팀원|동료|선생|강사|여러|모든|조원|분들|고객|사용|회원|이름|주회|교수|사장|부장|매니)$/.test(m[1])) {
        console.log(`CHECK ${f}: "${m[0]}" — 사람 이름인지 확인`);
      }
    }
  }
}
console.log(problems ? `${problems}건 발견` : `${files}개 파일, 금지 항목 없음`);
process.exit(problems ? 1 : 0);
