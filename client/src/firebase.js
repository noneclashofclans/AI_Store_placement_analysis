// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAERUdGhqmj7UszsDffEALVdgRpAv8LrvU",
  authDomain: "place-it-39a68.firebaseapp.com",
  projectId: "place-it-39a68",
  storageBucket: "place-it-39a68.firebasestorage.app",
  messagingSenderId: "900465339824",
  appId: "1:900465339824:web:b2055e1c305fe3f5717a75",
  measurementId: "G-PL337HXBLM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export {auth, provider};