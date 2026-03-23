import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, rtdb } from './config/firebase';
import { ref, onValue } from 'firebase/database';
import Login from './components/shared/Login';
import Signup from './components/shared/Signup';
import PatientDashboard from './components/patient/PatientDashboard';
import CaregiverDashboard from './components/caregiver/CaregiverDashboard';
import './components/shared/styles/auth.css';

export default function App() {
  const [authView, setAuthView] = useState('login'); // 'login', 'signup', 'home'
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'patient' or 'caregiver'
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // Get user type from Realtime Database
        const userRef = ref(rtdb, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val();
            console.log('User data from RTDB:', userData);
            console.log('User type:', userData.userType);
            setUserType(userData.userType || 'patient');
            setAuthView('home');
            setLoading(false);
          } else {
            console.warn('WARNING: User type not found in RTDB, defaulting to patient');
            setUserType('patient');
            setAuthView('home');
            setLoading(false);
          }
        }, (err) => {
          console.error('ERROR: Failed to load user type', err);
          setUserType('patient');
          setAuthView('home');
          setLoading(false);
        }, { onlyOnce: true });

        // Load today's slots/medicines from slots/{uid} for patient
        const slotsRef = ref(rtdb, `slots/${currentUser.uid}`);
        onValue(slotsRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            // Flatten slot.medicines[] into a flat list for Home.jsx compatibility
            const meds = [];
            Object.keys(data).forEach(slotId => {
              const slot = data[slotId];
              (slot.medicines || []).forEach(medName => {
                meds.push({
                  id: `${slotId}_${medName}`,
                  name: medName,
                  slot: slot.slotNumber,
                  medicineNumber: slot.slotNumber,
                  scheduledTime: slot.scheduledTime,
                  notes: slot.notes || '',
                });
              });
            });
            meds.sort((a, b) => (a.medicineNumber || 999) - (b.medicineNumber || 999));
            setMedicines(meds);
          } else {
            setMedicines([]);
          }
        }, (err) => {
          console.warn('Failed to load slots', err);
          setMedicines([]);
        });
      } else {
        setUser(null);
        setUserType(null);
        setAuthView('login');
        setMedicines([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (nextView) => {
    setAuthView(nextView);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserType(null);
      setAuthView('login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p style={{ textAlign: 'center', fontSize: '1.1rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (authView === 'login') {
    return <Login onSuccess={handleAuthSuccess} />;
  }

  if (authView === 'signup') {
    return <Signup onSuccess={handleAuthSuccess} />;
  }

  if (authView === 'home' && user) {
    console.log('Rendering dashboard for userType:', userType);
    if (userType === 'caregiver') {
      console.log('Rendering Caregiver Dashboard');
      return <CaregiverDashboard user={user} onLogout={handleLogout} />;
    } else if (userType === 'patient') {
      console.log('Rendering Patient Dashboard');
      return <PatientDashboard user={user} onLogout={handleLogout} medicines={medicines} />;
    }

    // Show a small loading state while determining user type
    console.log('Waiting for user type...');
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p style={{ textAlign: 'center', fontSize: '1.1rem' }}>Determining user type...</p>
        </div>
      </div>
    );
  }

  return null;
}
