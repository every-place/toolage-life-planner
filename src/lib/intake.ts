// The cloud drop box behind the task inbox. Other systems POST a task to
// Firestore's REST API at intake/{key}/tasks; the security rules accept it
// only when {key} is a key you turned on (intakeKeys/{key}), and only you
// can read or remove what lands there. While the app is open and signed in it
// moves each new task into your inbox and clears it from the drop box.

import { useEffect } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseProjectId } from './firebase';
import { addToInbox, readTask, type IntakeTask } from './inbox';
import type { MarginTag, PlannerState } from './model';

/** A long random key; anyone who has it can add tasks to your inbox (never read them). */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function intakeUrl(key: string): string {
  return `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/intake/${key}/tasks`;
}

/** Turns on a key for this account. */
export async function registerKey(uid: string, key: string) {
  await setDoc(doc(db, 'intakeKeys', key), { uid, createdAt: serverTimestamp() });
}

/** Turns a key off, so tasks sent with it are refused. */
export async function revokeKey(key: string) {
  await deleteDoc(doc(db, 'intakeKeys', key));
}

/** Watches the drop box and moves arrivals into the inbox. */
export function useIntake(uid: string | undefined, key: string | undefined, setState: (fn: (s: PlannerState) => PlannerState) => void) {
  useEffect(() => {
    if (!uid || !key) return;
    return onSnapshot(
      collection(db, 'intake', key, 'tasks'),
      (snap) => {
        const arrived = snap
          .docChanges()
          .filter((ch) => ch.type === 'added')
          .map((ch) => {
            const t = readTask(ch.doc.data());
            return t ? { ...t, intakeId: ch.doc.id } : null;
          })
          .filter((t): t is IntakeTask & { intakeId: string } => !!t);
        if (arrived.length) setState((s) => addToInbox(s, arrived, 'Sent in').state);
        // Clear the drop box; the inbox copy syncs to your other devices.
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'added') deleteDoc(ch.doc.ref).catch(() => undefined);
        });
      },
      () => undefined,
    );
  }, [uid, key, setState]);
}

/** Field names an intake task may have, all strings. */
const FIELDS = 'title (required), notes, tag, due (YYYY-MM-DD), priority (A, B or C, a suggestion only), source, link, id';

/** Example request body in Firestore's REST format. */
export function exampleBody(tags: MarginTag[]): string {
  const tag = tags[0]?.letter;
  const fields: Record<string, { stringValue: string }> = {
    title: { stringValue: 'Review the draft spec' },
    source: { stringValue: 'Claude: My project' },
  };
  if (tag) fields.tag = { stringValue: tag };
  fields.notes = { stringValue: 'Optional details.' };
  return JSON.stringify({ fields });
}

export function curlExample(key: string, tags: MarginTag[]): string {
  return `curl -sS -X POST '${intakeUrl(key)}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${exampleBody(tags)}'`;
}

/** Text to paste into a Claude project's instructions (or any assistant's). */
export function claudeInstructions(key: string, tags: MarginTag[]): string {
  const tagLines = tags.length
    ? tags.map((t) => `${t.letter} = ${t.label}`).join(', ')
    : 'none set up';
  return `## Sending tasks to my LifePlanner

When this project produces tasks or action items for me, offer to send them to my LifePlanner inbox, and send them when I say yes (or when I ask you to). Send each task as its own HTTPS POST:

${curlExample(key, tags)}

Rules:
- The body is Firestore's REST format: {"fields": {...}} where every value is {"stringValue": "..."}. Escape quotes and newlines as JSON requires.
- Fields: ${FIELDS}.
- Keep the title short and actionable, like a line in a paper planner. Put context in notes.
- Set source to "Claude: " plus this project's name.
- Margin tags: ${tagLines}. Use one only when it clearly applies; otherwise leave tag out.
- Don't set an ABC priority unless I ask; I prioritize the inbox myself while planning.
- To avoid duplicates when you might send the same task again, add ?documentId=<a short id with letters, digits, - or _> to the URL. A 409 ALREADY_EXISTS reply means it's already there.
- A 200 reply with a "name" field means the task arrived. A 403 means the key is wrong or was turned off; tell me instead of retrying.
- Afterwards, tell me how many tasks you sent.

Keep this key private: anyone with it can add tasks to my inbox (but can't read anything).`;
}
