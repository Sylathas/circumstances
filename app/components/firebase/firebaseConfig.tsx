import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDyzm2hDhA4YrNK8Y4LK0k3d7PzGGgbyIY",
  authDomain: "thecircumstances-479ff.firebaseapp.com",
  projectId: "thecircumstances-479ff",
  storageBucket: "thecircumstances-479ff.firebasestorage.app",
  messagingSenderId: "1049187691610",
  appId: "1:1049187691610:web:fd0aae00f08f74a1d33c63",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);