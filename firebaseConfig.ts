// firebaseConfig.ts
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAk9ReRsOP3615ysayTcfdEpXyIHv4eCAE",
  authDomain: "gestiondesetablissementsco.firebaseapp.com",
  projectId: "gestiondesetablissementsco",
  storageBucket: "gestiondesetablissementsco.firebasestorage.app",
  messagingSenderId: "359588684947",
  appId: "1:359588684947:web:79020fc0da0c3cf2c85966",
  measurementId: "G-T3NGPP7S81",
};

// ✅ évite “Firebase App named ‘[DEFAULT]’ already exists”
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
