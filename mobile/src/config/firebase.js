import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
    apiKey: "AIzaSyAi3y_SA1poRb-d1lKmLiME60ALlRf7Tq8",
    authDomain: "smartmeds-9b931.firebaseapp.com",
    projectId: "smartmeds-9b931",
    storageBucket: "smartmeds-9b931.firebasestorage.app",
    messagingSenderId: "462540698447",
    appId: "1:462540698447:web:071e5e19a8c701e8bf8b3a",
    measurementId: "G-YGTPHYCTY3",
    databaseURL: "https://smartmeds-9b931-default-rtdb.firebaseio.com"
};

// Initialize Firebase app only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with AsyncStorage persistence (only if not already initialized)
let auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
} catch (error) {
    // If already initialized, just get the existing instance
    auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
