import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "Your API Key",
    authDomain: "project-9b931.firebaseapp.com",
    projectId: "project-9b931",
    storageBucket: "project.firebasestorage.app",
    messagingSenderId: "462540698447",
    appId: "",
    measurementId: "G-YGTPHYCTY3",
    databaseURL: "Your DB URL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
