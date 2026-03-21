// app.config.js reads .env at build time via process.env and injects values
// into Constants.expoConfig.extra for use inside the app.
// The .env file is gitignored – never commit it.
import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'SmartMeds',
  slug: 'smartmeds-mobile',
  scheme: 'smartmeds',
  version: '1.0.0',
  platforms: ['android', 'web'],
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#4834d4',
      },
    ],
    'expo-font',
  ],
  web: { bundler: 'metro' },
  android: {
    package: 'com.anonymous.smartmedsmobile',
    permissions: ['NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
  },
  extra: {
    // Firebase config — sourced from .env file, never hardcoded
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
    firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL,
    eas: {
      projectId: '14c359f5-a647-4006-a63b-03a2b986caea',
    },
  },
  owner: 'sumukha_bhat',
});
