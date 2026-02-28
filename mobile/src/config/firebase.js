import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
    apiKey: "Your API Key",
    authDomain: "project-9b931.firebaseapp.com",
    projectId: "project-9b931",
    storageBucket: "project.firebasestorage.app",
    messagingSenderId: "462540698447",
    appId: "",
    measurementId: "G-YGTPHYCTY3",
    databaseURL: "Your DB URL"
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
