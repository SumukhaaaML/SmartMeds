import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { auth, db, rtdb } from './firebase';
import { ref, set } from 'firebase/database';
import './auth.css';

export default function Signup({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState('patient');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('weak');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 'weak';
    if (pwd.length < 6) return 'weak';
    if (pwd.length < 10) return 'medium';
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return 'strong';
    return 'medium';
  };

  const handlePasswordChange = (p) => {
    setPassword(p);
    setPasswordStrength(getPasswordStrength(p));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !name || !password || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Enter a valid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', uid), {
        email,
        name,
        userType,
        createdAt: new Date().toISOString()
      });

      // Create user profile in Realtime Database
      await set(ref(rtdb, `users/${uid}`), {
        email,
        name,
        userType,
        createdAt: new Date().toISOString()
      });

      // If patient, seed default medicines
      if (userType === 'patient') {
        const medsRef = collection(db, 'users', uid, 'medicines');
        const meds = ['Paracetamol', 'Ibuprofen', 'Aspirin', 'Metformin'];
        for (const m of meds) {
          await addDoc(medsRef, { name: m });
        }
      }

      // If caregiver, initialize empty patients list
      if (userType === 'caregiver') {
        await set(ref(rtdb, `caregivers/${uid}/patients`), {});
      }

      onSuccess('home');
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use' : err.code === 'auth/weak-password' ? 'Password too weak' : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">SmartMeds</h1>

        {/* User Type Selection */}
        <div className="user-type-selector">
          <label className="user-type-option">
            <input
              type="radio"
              name="userType"
              value="patient"
              checked={userType === 'patient'}
              onChange={(e) => setUserType(e.target.value)}
            />
            <span>Patient</span>
          </label>
          <label className="user-type-option">
            <input
              type="radio"
              name="userType"
              value="caregiver"
              checked={userType === 'caregiver'}
              onChange={(e) => setUserType(e.target.value)}
            />
            <span>Caregiver</span>
          </label>
        </div>

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            className="auth-input"
          />
          <div className="password-strength">
            <div className={`password-strength-bar ${passwordStrength}`}></div>
          </div>
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input"
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSuccess('login'); }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
