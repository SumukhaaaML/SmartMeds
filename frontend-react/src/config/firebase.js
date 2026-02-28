import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAi3y_SA1poRb-d1lKmLiME60ALlRf7Tq8",
    authDomain: "smartmeds-9b931.firebaseapp.com",
    projectId: "smartmeds-9b931",
    storageBucket: "smartmeds-9b931.firebasestorage.app",
    messagingSenderId: "462540698447",
    appId: "1:462540698447:web:071e5e19a8c701e8bf8b3a",
    measurementId: "G-YGTPHYCTY3",
    databaseURL: "https://smartmeds-9b931-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
