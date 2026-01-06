// Firebase setup
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAq8yzrDUtsJbVk9Vl-H5d18rFWvPl9T_4",
  authDomain: "snapmap-lite.firebaseapp.com",
  projectId: "snapmap-lite",
  storageBucket: "snapmap-lite.appspot.com",
  messagingSenderId: "874569389218",
  appId: "1:874569389218:web:4dd9cd48cb2fa2a74e73fb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);


