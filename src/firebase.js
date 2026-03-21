import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfyYctSRhlVpsyVjAW1MVF7Hf7A8dquxQ",
  authDomain: "budget-a-79eee.firebaseapp.com",
  projectId: "budget-a-79eee",
  storageBucket: "budget-a-79eee.firebasestorage.app",
  messagingSenderId: "403142385711",
  appId: "1:403142385711:web:0036939c895874fb4ee6da"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
