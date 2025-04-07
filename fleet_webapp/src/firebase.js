import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRMUe7_uZrXbYnHxOr7fR70fT14x7hcRY",
  authDomain: "sensors-data-fe6f3.firebaseapp.com",
  projectId: "sensors-data-fe6f3",
  storageBucket: "sensors-data-fe6f3.appspot.com",
  messagingSenderId: "862391940729",
  appId: "1:862391940729:web:bea1d1d054bbf514eb86a8",
  measurementId: "G-XERVJJ33F1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, setDoc, getDoc, doc, collection, query, where, getDocs, signOut };
