import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'node:url';

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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// This checks if we are running from 'src' (locally) or 'dist' (prod)
const publicPath = __dirname.endsWith('dist') 
  ? path.join(__dirname, 'public') 
  : path.join(__dirname, '../dist/public');

console.log('--- Path Configuration ---');
console.log('Serving static files from:', publicPath);
console.log('--------------------------');

// Configure Express
app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// Fetch stored data.
app.get('/api/data', async (req, res) => {
  try {
    const snapshot = await db.collection('items').get();

    if (snapshot.empty) {
      console.log('Connected, but no documents found.');
      return res.json([]);
    }

    const data = snapshot.docs.map(doc => doc.data());
    res.json(data);
  } catch (error) {
    console.error("Firestore Error:", error);
    throw error;
  }

});

// The Catch-all: Route all other requests to index.html
// This allows Angular to handle deep links like /clanmanager/dashboard
app.get('*splat', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start serving
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
