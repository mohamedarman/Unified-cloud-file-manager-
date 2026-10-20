import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';

async function testConnection() {
  try {
    // Attempting a simple read to verify connection
    await getDocFromServer(doc(db, 'connection_test', 'check'));
    console.log("Firestore connection successful");
  } catch (error) {
    console.error("Firestore connection failed:", error);
  }
}
testConnection();
