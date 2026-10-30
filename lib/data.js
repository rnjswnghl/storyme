// 서버에서 기록·서사 데이터를 한 번만 읽어 둔다.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cache;
export async function loadData() {
  if (!cache) {
    const root = process.cwd();
    const [records, story] = await Promise.all([
      readFile(path.join(root, 'dist/data/records.json'), 'utf8').then(JSON.parse),
      readFile(path.join(root, 'dist/data/story.json'), 'utf8').then(JSON.parse),
    ]);
    cache = { records, story };
  }
  return cache;
}
