import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  increment,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Load Firebase configuration from env first, then local config file.
const configPath = path.join(__dirname, 'firebase-applet-config.json');
let db = null;

const requiredFirebaseFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

const loadFirebaseConfig = () => {
  if (process.env.FIREBASE_APPLET_CONFIG_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_APPLET_CONFIG_JSON);
    } catch (err) {
      console.warn('FIREBASE_APPLET_CONFIG_JSON is not valid JSON; falling back to individual env vars/file.');
    }
  }

  const envConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID
  };

  const hasEnvConfig = requiredFirebaseFields.every((field) => Boolean(envConfig[field]));
  if (hasEnvConfig) {
    return envConfig;
  }

  if (!fs.existsSync(configPath)) {
    console.warn('firebase-applet-config.json not found on server; continuing without Firestore.');
    return null;
  }

  const configRaw = fs.readFileSync(configPath, 'utf8').trim();
  if (!configRaw) {
    console.warn('firebase-applet-config.json is empty; continuing without Firestore.');
    return null;
  }

  return JSON.parse(configRaw);
};

try {
  const config = loadFirebaseConfig();
  if (config) {
    const missingFields = requiredFirebaseFields.filter((field) => !config[field]);
    if (missingFields.length > 0) {
      console.warn(`Firebase config is missing fields: ${missingFields.join(', ')}; continuing without Firestore.`);
    } else {
      const firebaseApp = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      });

      const dbId = config.firestoreDatabaseId || '(default)';
      db = getFirestore(firebaseApp, dbId);
      console.log(`Firebase Firestore initialized on server with database ID: ${dbId}`);
    }
  }
} catch (err) {
  console.warn('Firebase initialization skipped:', err.message);
}

const getStatsDocRef = () => (db ? doc(db, 'counters', 'WN3ed25ntpMhS5ow4apl') : null);

let fallbackGamesPlayed = 0;

// Backend API Endpoints
app.get('/api/stats', async (req, res) => {
  try {
    const ref = getStatsDocRef();
    if (!ref) {
      return res.json({ gamesPlayed: fallbackGamesPlayed });
    }
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { gamesPlayed: 0 };
    res.json({ gamesPlayed: data.gamesPlayed ?? 0 });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats', gamesPlayed: fallbackGamesPlayed });
  }
});

app.post('/api/stats/increment', async (req, res) => {
  try {
    const ref = getStatsDocRef();
    if (!ref) {
      fallbackGamesPlayed += 1;
      return res.json({ success: true, gamesPlayed: fallbackGamesPlayed });
    }
    await setDoc(ref, { gamesPlayed: increment(1) }, { merge: true });
    const snap = await getDoc(ref);
    const count = snap.exists() ? snap.data().gamesPlayed : 0;
    res.json({ success: true, gamesPlayed: count });
  } catch (err) {
    console.error('Error incrementing stats:', err);
    fallbackGamesPlayed += 1;
    res.status(500).json({ error: 'Failed to increment stats', gamesPlayed: fallbackGamesPlayed });
  }
});

// Real-time server-sent events for game statistics
app.get('/api/stats/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const ref = getStatsDocRef();
  if (!ref) {
    res.write(`data: ${JSON.stringify({ gamesPlayed: fallbackGamesPlayed })}\n\n`);
    return;
  }

  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? snap.data() : { gamesPlayed: 0 };
      res.write(`data: ${JSON.stringify({ gamesPlayed: data.gamesPlayed ?? 0 })}\n\n`);
    },
    (error) => {
      console.error('Snapshot error in SSE stream:', error);
    }
  );

  req.on('close', () => {
    unsubscribe();
  });
});

app.get('/api/healthcheck', async (req, res) => {
  try {
    if (!db) {
      return res.json({
        status: 'degraded',
        message: 'Database uninitialized',
        firebaseConfigured: false
      });
    }
    const probeDoc = doc(db, 'healthcheck', 'web-connection');
    await setDoc(
      probeDoc,
      { source: '11-tehni-backend', lastPing: serverTimestamp() },
      { merge: true }
    );
    const snap = await getDoc(probeDoc);
    if (!snap.exists()) {
      return res.status(500).json({ status: 'error', message: 'Probe document write failed' });
    }
    res.json({ status: 'ok', firebaseConfigured: true, data: snap.data() });
  } catch (err) {
    console.error('Healthcheck error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Serve static web app assets
app.use(express.static(__dirname));

// Fallback route for index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} is already in use. Trying to use port ${PORT + 1} instead.`);
    app.listen(PORT + 1, '0.0.0.0', () => {
      console.log(`Backend server running on http://0.0.0.0:${PORT + 1}`);
    });
  } else {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
});
