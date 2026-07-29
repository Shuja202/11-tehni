import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  increment,
  getDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCUVxQKF56IkT46ujvByFelLALi2dMm3Gg',
  authDomain: 'tehni-d2eac.firebaseapp.com',
  projectId: 'tehni-d2eac',
  storageBucket: 'tehni-d2eac.firebasestorage.app',
  messagingSenderId: '728762115452',
  appId: '1:728762115452:web:7c44a365cec227974af0f9',
};                                                      

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const statsDoc = doc(db, 'counters', 'WN3ed25ntpMhS5ow4apl');

export function initStats(onCountUpdate) {
  onSnapshot(statsDoc, (snap) => {
    onCountUpdate(snap.data()?.gamesPlayed ?? 0);
  });
}

export function incrementGamesPlayed() {
  setDoc(statsDoc, { gamesPlayed: increment(1) }, { merge: true });
}

export async function runFirebaseConnectionTest() {
  const probeDoc = doc(db, 'healthcheck', 'web-connection');

  await setDoc(
    probeDoc,
    {
      source: '11-tehni',
      lastPing: serverTimestamp(),
    },
    { merge: true }
  );

  const probeSnap = await getDoc(probeDoc);
  if (!probeSnap.exists()) {
    throw new Error('Connection test failed: probe document not found after write.');
  }

  return probeSnap.data();
}
