// 공유 저장소. Vercel Blob에 항목 하나를 JSON 파일 하나로 저장한다(동시 쓰기 충돌이 없다).
// BLOB_READ_WRITE_TOKEN이 없으면(로컬 개발) 프로세스 메모리에 저장한다.
import { randomBytes } from 'node:crypto';

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const memory = new Map(); // prefix → Map(id → item)

function newId() {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

export async function create(prefix, data) {
  const item = { id: newId(), createdAt: new Date().toISOString(), ...data };
  if (hasBlob) {
    const { put } = await import('@vercel/blob');
    await put(`${prefix}/${item.id}.json`, JSON.stringify(item), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  } else {
    if (!memory.has(prefix)) memory.set(prefix, new Map());
    memory.get(prefix).set(item.id, item);
  }
  return item;
}

export async function all(prefix, limit = 200) {
  if (!hasBlob) return [...(memory.get(prefix)?.values() ?? [])].sort(newestFirst).slice(0, limit);
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: `${prefix}/`, limit });
  const items = await Promise.all(
    blobs.map(async (b) => {
      try {
        const r = await fetch(b.url, { cache: 'no-store' });
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    }),
  );
  return items.filter(Boolean).sort(newestFirst);
}

export async function one(prefix, id) {
  if (!/^[a-z0-9]+-[a-f0-9]{8}$/.test(id)) return null;
  if (!hasBlob) return memory.get(prefix)?.get(id) ?? null;
  const { head } = await import('@vercel/blob');
  try {
    const meta = await head(`${prefix}/${id}.json`);
    const r = await fetch(meta.url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function remove(prefix, id) {
  if (!/^[a-z0-9]+-[a-f0-9]{8}$/.test(id)) return false;
  if (!hasBlob) return memory.get(prefix)?.delete(id) ?? false;
  const { del } = await import('@vercel/blob');
  await del(`${prefix}/${id}.json`);
  return true;
}

function newestFirst(a, b) {
  return b.createdAt.localeCompare(a.createdAt);
}

export const backend = hasBlob ? 'blob' : 'memory';
