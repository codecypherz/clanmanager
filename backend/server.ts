import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();
app.use(cors());
app.use(express.json());

admin.initializeApp();
const db = admin.firestore();

app.get('/api/data', async (req, res) => {
  const snapshot = await db.collection('items').get();
  const data = snapshot.docs.map(doc => doc.data());
  res.json(data);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
