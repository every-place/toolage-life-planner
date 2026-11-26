// Photos of handwritten notes, kept in the browser's IndexedDB so they don't
// crowd out the planner data in local storage. Tasks keep only photo ids.
// When signed in, each photo is also copied to the cloud so other devices
// can fetch it the first time they show it.

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

/** A cloud document holds at most 1 MiB, so photos stay under this. */
const CLOUD_MAX_BYTES = 950_000;

export interface PhotoCloud {
  put: (id: string, blob: Blob) => Promise<void>;
  get: (id: string) => Promise<Blob | undefined>;
  del: (id: string) => Promise<void>;
}

let cloud: PhotoCloud | null = null;
const UPLOADED_KEY = 'lifeplanner.photosUploaded';

function uploaded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markUploaded(id: string, on: boolean) {
  const s = uploaded();
  if (on) s.add(id);
  else s.delete(id);
  try {
    localStorage.setItem(UPLOADED_KEY, JSON.stringify([...s]));
  } catch {
    // Not critical: worst case the photo is uploaded again.
  }
}

/** Set while signed in; null when sync is off. */
export function setPhotoCloud(c: PhotoCloud | null) {
  cloud = c;
}

async function upload(id: string, blob: Blob) {
  if (!cloud) return;
  let b = blob;
  if (b.size > CLOUD_MAX_BYTES) b = await compressImage(b, 1200, 0.7);
  if (b.size > CLOUD_MAX_BYTES) b = await compressImage(b, 900, 0.6);
  await cloud.put(id, b);
  markUploaded(id, true);
}

/** Copies to the cloud any of these photos this device has but hasn't uploaded. */
export async function uploadMissingPhotos(ids: string[]) {
  if (!cloud) return;
  const done = uploaded();
  for (const id of new Set(ids)) {
    if (done.has(id)) continue;
    const blob = await getLocal(id).catch(() => undefined);
    if (blob) await upload(id, blob).catch(() => undefined);
  }
}

/** Shrinks a camera photo to a readable JPEG of at most maxEdge pixels. */
export async function compressImage(file: Blob, maxEdge = MAX_EDGE, quality = QUALITY): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality),
    );
  } catch {
    return file;
  }
}

export async function savePhoto(file: Blob): Promise<string> {
  const blob = await compressImage(file);
  const id = `ph-${newId()}`;
  await run('readwrite', (s) => s.put(blob, id));
  upload(id, blob).catch(() => undefined);
  return id;
}

function getLocal(id: string): Promise<Blob | undefined> {
  return run('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

/** The photo from this device, or from the cloud the first time it's needed here. */
export async function getPhoto(id: string): Promise<Blob | undefined> {
  const local = await getLocal(id).catch(() => undefined);
  if (local || !cloud) return local;
  // The task can arrive from the other device a moment before its photo
  // finishes uploading, so keep checking for a little while.
  let blob: Blob | undefined;
  for (let wait = 1000; wait <= 16000 && cloud; wait *= 2) {
    blob = await cloud.get(id).catch(() => undefined);
    if (blob) break;
    await new Promise((r) => setTimeout(r, wait));
  }
  if (blob) {
    await run('readwrite', (s) => s.put(blob, id)).catch(() => undefined);
    markUploaded(id, true);
  }
  return blob;
}

export async function deletePhoto(id: string): Promise<undefined> {
  await run('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
  markUploaded(id, false);
  if (cloud) await cloud.del(id).catch(() => undefined);
  return undefined;
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
    markUploaded(id, false);
    upload(id, blob).catch(() => undefined);
    n += 1;
  }
  return n;
}
