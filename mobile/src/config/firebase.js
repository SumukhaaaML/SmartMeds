import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase config is injected at build time from .env via app.config.js
// Access via Constants.expoConfig.extra — never hardcode keys here.
const {
    firebaseApiKey,
    firebaseAuthDomain,
    firebaseProjectId,
    firebaseStorageBucket,
    firebaseMessagingSenderId,
    firebaseAppId,
    firebaseMeasurementId,
    firebaseDatabaseUrl,
} = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
    apiKey: firebaseApiKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    storageBucket: firebaseStorageBucket,
    messagingSenderId: firebaseMessagingSenderId,
    appId: firebaseAppId,
    measurementId: firebaseMeasurementId,
    databaseURL: firebaseDatabaseUrl,
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

export { auth, firebaseConfig };
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

