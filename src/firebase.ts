import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const isNodeRuntime =
  typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node ===
  'string';

export const db = initializeFirestore(
  app,
  typeof window !== 'undefined' && !isNodeRuntime
    ? { experimentalForceLongPolling: true }
    : {},
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
