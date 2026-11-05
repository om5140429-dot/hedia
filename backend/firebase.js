import { cert, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const app = initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = getDatabase(app);

export function saveStreamUrl(movieId, streamUrl) {
  return db.ref(`movies/${movieId}/streamUrl`).set(streamUrl);
}

export function clearStreamUrl(movieId) {
  return db.ref(`movies/${movieId}/streamUrl`).remove();
}
