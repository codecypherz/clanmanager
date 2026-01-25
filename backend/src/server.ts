import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { getFirestore } from 'firebase-admin/firestore';

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

const app = express();
app.use(cors());
app.use(express.json());

const db = getFirestore('clanmanager');

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
