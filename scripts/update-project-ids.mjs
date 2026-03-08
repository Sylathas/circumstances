/**
 * Fetches project IDs from Firestore and writes project-ids.json for static export.
 * Run before deploy: npm run update-project-ids && npm run deploy
 * Requires network access. If Firestore fails in Node, add project-ids.json manually (array of id strings).
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { writeFileSync } from "fs";
import { join } from "path";

const firebaseConfig = {
  apiKey: "AIzaSyDyzm2hDhA4YrNK8Y4LK0k3d7PzGGgbyIY",
  authDomain: "thecircumstances-479ff.firebaseapp.com",
  projectId: "thecircumstances-479ff",
  storageBucket: "thecircumstances-479ff.firebasestorage.app",
  messagingSenderId: "1049187691610",
  appId: "1:1049187691610:web:fd0aae00f08f74a1d33c63",
};

const app = initializeApp(firebaseConfig, "updateProjectIds");
const db = getFirestore(app);

const snap = await getDocs(collection(db, "projects"));
const ids = snap.docs.map((d) => d.id).sort();
const outPath = join(process.cwd(), "project-ids.json");
writeFileSync(outPath, JSON.stringify(ids, null, 2), "utf8");
console.log("Wrote", ids.length, "project ids to", outPath);
