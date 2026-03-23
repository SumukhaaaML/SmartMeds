// app.config.js reads .env at build time via process.env and injects values
// into Constants.expoConfig.extra for use inside the app.
// The .env file is gitignored – never commit it.
try { require('dotenv').config(); } catch (_) { /* dotenv not available in this context – env already loaded by shell */ }

module.exports = ({ config }) => ({
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
    [
      'expo-audio',
      {
        microphonePermission: 'Allow SmartMeds to access your microphone for voice commands.',
      },
    ],
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
      projectId: '1fc10644-f7ed-42c6-ad52-4db416b9b9a8',
    },
  },
  owner: 'sumukha_ml',
});
