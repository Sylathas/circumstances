/**
 * Firestore-only init for build-time (generateStaticParams).
 * Avoids loading Auth/Storage which can hang in Node.
 */
import { initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyzm2hDhA4YrNK8Y4LK0k3d7PzGGgbyIY",
  authDomain: "thecircumstances-479ff.firebaseapp.com",
  projectId: "thecircumstances-479ff",
  storageBucket: "thecircumstances-479ff.firebasestorage.app",
  messagingSenderId: "1049187691610",
  appId: "1:1049187691610:web:fd0aae00f08f74a1d33c63",
};

let buildDb: Firestore | null = null;

export function getBuildTimeDb(): Firestore {
  if (!buildDb) {
    const app = initializeApp(firebaseConfig, "buildTime");
    buildDb = getFirestore(app);
  }
  return buildDb;
}
