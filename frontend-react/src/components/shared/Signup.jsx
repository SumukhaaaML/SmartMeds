import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, rtdb } from '../../config/firebase';
import { ref, set, push } from 'firebase/database';
import './styles/auth.css';

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
        if (pwd.length < 8) return 'weak';

        const hasLower = /[a-z]/.test(pwd);
        const hasUpper = /[A-Z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

        const conditions = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

        if (pwd.length >= 12 && conditions >= 3) return 'strong';
        if (pwd.length >= 10 && conditions >= 2) return 'medium';
        return 'weak';
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
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        // Enforce strong password requirements
        if (!/[a-z]/.test(password)) {
            setError('Password must contain lowercase letter');
            return;
        }
        if (!/[A-Z]/.test(password)) {
            setError('Password must contain uppercase letter');
            return;
        }
        if (!/[0-9]/.test(password)) {
            setError('Password must contain a number');
            return;
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            setError('Password must contain a special character');
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

            // Create user profile in Realtime Database
            await set(ref(rtdb, `users/${uid}`), {
                email,
                name,
                userType,  // Use camelCase!
                createdAt: new Date().toISOString()
            });

            // If patient, seed default medicines in RTDB
            if (userType === 'patient') {
                const medicinesRef = ref(rtdb, `medicines/${uid}`);
                const meds = ['Paracetamol', 'Ibuprofen', 'Aspirin', 'Metformin'];
                for (const medName of meds) {
                    const newMedRef = push(medicinesRef);
                    await set(newMedRef, {
                        name: medName,
                        dosage: 'As prescribed',
                        addedAt: new Date().toISOString()
                    });
                }
            }

            // If caregiver, initialize empty patients list
            if (userType === 'caregiver') {
                await set(ref(rtdb, `caregivers/${uid}/patients`), {});
            }

            console.log('✅ User created successfully:', uid, userType);
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
                <h1 className="auth-title">🏥 SmartMeds</h1>
                <p className="auth-subtitle">Voice-powered medicine dispensing</p>

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
                        <span>👤 Patient</span>
                    </label>
                    <label className="user-type-option">
                        <input
                            type="radio"
                            name="userType"
                            value="caregiver"
                            checked={userType === 'caregiver'}
                            onChange={(e) => setUserType(e.target.value)}
                        />
                        <span>👨‍⚕️ Caregiver</span>
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
