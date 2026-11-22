// Photos of handwritten notes, kept in the browser's IndexedDB so they don't
// crowd out the planner data in local storage. Tasks keep only photo ids.

import { newId } from './model';

const DB = 'lifeplanner-photos';
const STORE = 'photos';
const MAX_EDGE = 1600; // px, enough to read handwriting
const QUALITY = 0.8;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Shrinks a camera photo to a readable JPEG of at most MAX_EDGE pixels. */
export async function compressImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', QUALITY),
    );
  } catch {
    return file;
  }
}

export async function savePhoto(file: Blob): Promise<string> {
  const blob = await compressImage(file);
  const id = `ph-${newId()}`;
  await run('readwrite', (s) => s.put(blob, id));
  return id;
}

export function getPhoto(id: string): Promise<Blob | undefined> {
  return run('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export function deletePhoto(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** All photos the given ids point to, as data URLs, for a backup file. */
export async function exportPhotos(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of new Set(ids)) {
    const blob = await getPhoto(id).catch(() => undefined);
    if (blob) out[id] = await blobToDataUrl(blob);
  }
  return out;
}

export async function importPhotos(photos: Record<string, string>): Promise<number> {
  let n = 0;
  for (const [id, url] of Object.entries(photos)) {
    const blob = await (await fetch(url)).blob();
    await run('readwrite', (s) => s.put(blob, id));
    n += 1;
  }
  return n;
}
