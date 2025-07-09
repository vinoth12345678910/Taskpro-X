// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB-cfrZI67_V1BAw_ndzdACfCLUxiuPvHQ",
  authDomain: "taskprox-58458.firebaseapp.com",
  projectId: "taskprox-58458",
  storageBucket: "taskprox-58458.appspot.com",
  messagingSenderId: "341647400164",
  appId: "1:341647400164:web:bd01ce4e0775bc0343a0f1",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);