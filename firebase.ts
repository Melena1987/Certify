import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// IMPORTANT: Replace with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLB-Nse95J12bG88sUz-1FFYlh2N97sz4",
  authDomain: "certify-diputacion.firebaseapp.com",
  projectId: "certify-diputacion",
  storageBucket: "certify-diputacion.firebasestorage.app",
  messagingSenderId: "52185000301",
  appId: "1:52185000301:web:e48e113f179adbecbb1264"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };