import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBQYDkQKQNMM2f3kwcIHOFVUErBr2geUWo",
  authDomain: "gcgd-4802b.firebaseapp.com",
  projectId: "gcgd-4802b",
  storageBucket: "gcgd-4802b.firebasestorage.app",
  messagingSenderId: "34446625836",
  appId: "1:34446625836:web:a243eba174822c27789589",
  measurementId: "G-6T3SMTCPL2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google 로그인 설정 강화
const provider = new GoogleAuthProvider();
provider.addScope('profile');
provider.addScope('email');
provider.setCustomParameters({
  prompt: 'select_account'
});

const db = getFirestore(app);

export { auth, provider, signInWithPopup, onAuthStateChanged, db };