// Firebase project for LifePlanner. This config identifies the project and is
// safe to publish; access is controlled by the Firestore security rules
// (each signed-in person can only read and write their own users/{uid} data).

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA7D-PvQLunWLraq64On7-3tdst9OMrOsI',
  authDomain: 'toolage-life-planner.firebaseapp.com',
  projectId: 'toolage-life-planner',
  storageBucket: 'toolage-life-planner.firebasestorage.app',
  messagingSenderId: '502596886105',
  appId: '1:502596886105:web:b6ad6f1ababb47ee9bdb48',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Keeps a copy in the browser so the app works offline and catches up later.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// For testing only: `VITE_FIREBASE_EMULATORS=1 npm run build` talks to the
// local Firebase emulators instead of the real project.
if (import.meta.env.VITE_FIREBASE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
