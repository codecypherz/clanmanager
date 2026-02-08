import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { ClanSnapshot } from '@clan-manager/shared';

// Initialize Firebase
try {
  console.info("Initializing Firestore");
  if (process.env.K_SERVICE) {
    // We are on Cloud Run, use default initialization
    admin.initializeApp();
  } else {
    // We are local, use the local service account key
    // Read in the credentials based on what is set in .env
    const keyPath = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY;
    const serviceAccount = JSON.parse(
      await readFile(new URL('../' + keyPath, import.meta.url), 'utf8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId
    });
  }
} catch (e) {
  console.error("Firestore init failed:", e);
  throw e;
}

const db = getFirestore('clanmanager');
console.log("Firestore initialized successfully");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the 'public' directory
// Recreate __dirname for ES Modules
// In a monorepo TSC build with rootDir: "..", 
// the file is at: /dist/backend/src/server.js
// We need to go up TWO levels to reach /dist/ where 'public' lives.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../../public');

console.log('--- Path Configuration ---');
console.log('__dirname is:', __dirname);
console.log('Serving static files from:', publicPath);
console.log('--------------------------');

// Configure Express
app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// Save a new snapshot
app.post('/api/snapshots', async (req, res) => {
  try {
    const snapshotData: ClanSnapshot = req.body;
    
    if (snapshotData.id) {
      res.status(400).send("Attempted to save an already saved snapshot.");
      return;
    }

    // Ensure timestamp is a Date object (if passed as string)
    snapshotData.timestamp = new Date(snapshotData.timestamp);

    const docRef = await db.collection('snapshots').add(snapshotData);

    // TODO: Delete snapshots if we have more than 100.

    res.status(201).json({ id: docRef.id, ...snapshotData });

  } catch (error) {
    console.error("Error saving snapshot:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Fetch snapshots for a specific clan
app.get('/api/snapshots/:clanTag', async (req, res) => {
  console.log("Fetching snapshots from Firestore");
  try {
    const { clanTag } = req.params;
    const { since } = req.query; // Optional: fetch only newer than this ISO string

    let query = db.collection('snapshots')
      .where('clanTag', '==', clanTag)
      .orderBy('timestamp', 'desc');

    if (since) {
      query = query.where('timestamp', '>', new Date(since as string));
    }

    const firestoreSnap = await query.limit(100).get();
    const history = firestoreSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        timestamp: data.timestamp.toDate() // Convert Firestore Timestamp to JS Date
      };
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    res.status(500).send("Internal Server Error");
  }
});

// The Catch-all: Route all other requests to index.html
// This allows Angular to handle deep links like /clanmanager/dashboard
app.get('*splat', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start serving
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
