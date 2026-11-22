// Cloud sync with Firebase: sign in with Google, then every change on one
// device is written to Firestore and shows up on the others within seconds.
// Local storage stays the working copy, so the app still opens offline.

import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { emptyState, type PlannerState } from './model';
import { applyDoc, COLLECTIONS, diffState, mergeFirst, type DocOp } from './syncModel';
import { setPhotoCloud, uploadMissingPhotos } from './photos';

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error';

export interface Cloud {
  user: User | null;
  /** False until Firebase has said whether someone is signed in. */
  ready: boolean;
  status: SyncStatus;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function writeOps(uid: string, ops: DocOp[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      const ref = doc(db, 'users', uid, op.coll, op.id);
      if (op.data === null) batch.delete(ref);
      else batch.set(ref, op.data);
    }
    await batch.commit();
  }
}

function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied'))
    return 'The cloud database refused access. Check that the Firestore rules from setup are published.';
  if (code.includes('unauthorized-domain')) return 'This web address is not on the Firebase list of authorized domains.';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '';
  return 'Sync hit a problem. Your planner is still saved on this device; it will catch up when sync works again.';
}

function photoCloud(uid: string) {
  const ref = (id: string) => doc(db, 'users', uid, 'photos', id);
  return {
    async put(id: string, blob: Blob) {
      const data = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
      await setDoc(ref(id), { type: blob.type || 'image/jpeg', data });
    },
    async get(id: string) {
      const snap = await getDoc(ref(id));
      const d = snap.data() as { type?: string; data?: Bytes } | undefined;
      return d?.data ? new Blob([d.data.toUint8Array()], { type: d.type || 'image/jpeg' }) : undefined;
    },
    async del(id: string) {
      await deleteDoc(ref(id));
    },
  };
}

export function useCloudSync(state: PlannerState, setState: (fn: (s: PlannerState) => PlannerState) => void): Cloud {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [error, setError] = useState('');
  // What the cloud holds, as far as this device knows. Null while not syncing.
  const baseline = useRef<PlannerState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  const uid = user?.uid;

  // Sign-in: merge this device with the cloud, then listen for changes.
  useEffect(() => {
    if (!uid) {
      baseline.current = null;
      setStatus('off');
      setPhotoCloud(null);
      return;
    }
    let live = true;
    const unsubs: (() => void)[] = [];
    setStatus('connecting');
    setError('');
    (async () => {
      const remote: DocOp[] = [];
      for (const c of COLLECTIONS) {
        const snap = await getDocs(collection(db, 'users', uid, c));
        snap.forEach((d) => remote.push({ coll: c, id: d.id, data: d.data() }));
      }
      if (!live) return;
      const inCloud = mergeFirst(emptyState(), remote);
      const merged = mergeFirst(stateRef.current, remote);
      await writeOps(uid, diffState(inCloud, merged));
      if (!live) return;
      baseline.current = merged;
      setState(() => merged);
      setStatus('synced');

      const cloud = photoCloud(uid);
      setPhotoCloud(cloud);
      uploadMissingPhotos(merged.tasks.flatMap((t) => t.photos ?? [])).catch(() => undefined);

      for (const c of COLLECTIONS) {
        unsubs.push(
          onSnapshot(
            collection(db, 'users', uid, c),
            (snap) => {
              const ops: DocOp[] = snap
                .docChanges()
                .filter((ch) => !ch.doc.metadata.hasPendingWrites)
                .map((ch) => ({ coll: c, id: ch.doc.id, data: ch.type === 'removed' ? null : ch.doc.data() }));
              if (!ops.length) return;
              setState((s) => {
                // Keep the baseline in step so these changes aren't written back.
                baseline.current = ops.reduce(applyDoc, baseline.current ?? s);
                return ops.reduce(applyDoc, s);
              });
              setStatus('synced');
            },
            (e) => {
              setStatus('error');
              setError(explain(e));
            },
          ),
        );
      }
    })().catch((e) => {
      if (!live) return;
      setStatus('error');
      setError(explain(e));
    });
    return () => {
      live = false;
      unsubs.forEach((u) => u());
      baseline.current = null;
    };
  }, [uid, setState]);

  // Every local change: write what differs from the cloud copy.
  useEffect(() => {
    const b = baseline.current;
    if (!b || !uid) return;
    const ops = diffState(b, state);
    baseline.current = state;
    if (!ops.length) return;
    writeOps(uid, ops).catch((e) => {
      setStatus('error');
      setError(explain(e));
    });
    const added = ops.filter((o) => o.coll === 'tasks' && o.data).flatMap((o) => (o.data!.photos as string[] | undefined) ?? []);
    if (added.length) uploadMissingPhotos(added).catch(() => undefined);
  }, [state, uid]);

  const signIn = async () => {
    setError('');
    if (import.meta.env.VITE_FIREBASE_EMULATORS) {
      // Test builds only: the emulator accepts a made-up Google account.
      const fake = { sub: 'test-aaron', email: 'aaron@example.com', email_verified: true, name: 'Aaron' };
      await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(fake)));
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
        await signInWithRedirect(auth, provider);
        return;
      }
      setError(explain(e));
    }
  };

  return { user, ready, status, error, signIn, signOut: () => signOut(auth) };
}
