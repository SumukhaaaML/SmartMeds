import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, rtdb } from './src/config/firebase';
import { ref, get, child } from 'firebase/database';
import Login from './src/components/shared/Login';
import Signup from './src/components/shared/Signup';
import PatientDashboard from './src/components/patient/PatientDashboard';
import CaregiverDashboard from './src/components/caregiver/CaregiverDashboard';
import {
  registerForPushNotifications,
  sendTokenToBackend,
  setupNotificationListeners
} from './src/services/NotificationService';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading', 'signed-out', 'signed-in', 'login', 'signup'
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'patient' or 'caregiver'

  useEffect(() => {
    initializeApp();

    // Auth State Listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('App: User signed in:', firebaseUser.email);
        try {
          // Fetch user type using SDK
          const userSnapshot = await get(child(ref(rtdb), `users/${firebaseUser.uid}`));

          let userInfo = {};
          if (userSnapshot.exists()) {
            userInfo = userSnapshot.val();
            console.log('App: User Info from DB:', userInfo);
          } else {
            console.log('App: User data not found in DB');
          }

          const finalUserType = userInfo?.userType || 'patient';
          const appUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            ...userInfo
          };

          setUser(appUser);
          setUserType(finalUserType);
          setAuthState('signed-in');

        } catch (err) {
          console.error('App: Error fetching user data', err);
          // Fallback
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          setUserType('patient');
          setAuthState('signed-in');
        }
      } else {
        console.log('App: User signed out');
        setUser(null);
        setUserType(null);
        if (authState !== 'signup' && authState !== 'login') {
          setAuthState('signed-out');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Setup push notifications when user is authenticated
  useEffect(() => {
    let cleanup = null;

    if (user?.uid && authState === 'signed-in') {
      // Register for push notifications
      registerForPushNotifications().then(token => {
        if (token) {
          sendTokenToBackend(user.uid, token);
        }
      });

      // Setup notification listeners
      cleanup = setupNotificationListeners();
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [user?.uid, authState]);

  async function initializeApp() {
    try {
      if (Platform.OS !== 'web') {
        try {
          await Audio.requestPermissionsAsync();
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true
          });
        } catch (permErr) {
          console.warn('Permission request failed:', permErr);
        }
      }
    } catch (err) {
      console.warn('Initialization failed', err);
    }
  }

  function handleAuthNavigation(userData, nextView) {
    if (nextView === 'signup' || nextView === 'login') {
      setAuthState(nextView);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setAuthState('login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  }

  if (authState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (authState === 'signed-out' || authState === 'login') {
    return <Login onSuccess={handleAuthNavigation} />;
  }

  if (authState === 'signup') {
    return <Signup onSuccess={handleAuthNavigation} />;
  }

  if (authState === 'signed-in' && user) {
    if (userType === 'caregiver') {
      return <CaregiverDashboard user={user} onLogout={handleLogout} />;
    }
    return <PatientDashboard user={user} onLogout={handleLogout} />;
  }

  return <Login onSuccess={handleAuthNavigation} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6fa'
  },
});
