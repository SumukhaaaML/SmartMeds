import { useState } from 'react';
import { rtdb } from '../../config/firebase';
import { ref, onValue, remove, set, get } from 'firebase/database';

export default function PatientList({ user, patients, setPatients, onSelectPatient, selectedPatient }) {
    const [newPatientEmail, setNewPatientEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const addPatient = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newPatientEmail.trim()) {
            setError('Enter patient email');
            return;
        }

        setLoading(true);
        try {
            console.log('🔍 Step 1: Searching for patient with email:', newPatientEmail);

            // Find patient by email in Realtime Database
            const usersRef = ref(rtdb, 'users');

            console.log('🔍 Step 2: Attempting to read /users from RTDB...');
            const snapshot = await get(usersRef);
            console.log('✅ Step 2: Successfully read /users');

            let patientId = null;
            let patientInfo = null;

            if (snapshot.exists()) {
                const users = snapshot.val();
                console.log('📊 Found users:', Object.keys(users).length);

                for (const uid in users) {
                    if (users[uid].email === newPatientEmail && users[uid].userType === 'patient') {
                        patientId = uid;
                        patientInfo = {
                            ...users[uid],
                            id: uid
                        };
                        console.log('✅ Found patient:', patientInfo.name, 'UID:', uid);
                        break;
                    }
                }
            }

            if (!patientId || !patientInfo) {
                console.log('❌ Patient not found in database');
                setError('Patient not found or not a patient account');
                setLoading(false);
                return;
            }

            console.log('🔍 Step 3: Attempting to write to /caregivers/' + user.uid + '/patients/' + patientId);

            // Add patient to caregiver's list
            await set(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`), {
                name: patientInfo.name,
                email: patientInfo.email,
                addedAt: new Date().toISOString()
            });

            console.log('✅ Step 3: Successfully added patient');
            setSuccess(`✅ Patient ${patientInfo.name} added successfully!`);
            setNewPatientEmail('');
        } catch (err) {
            console.error('❌ Error at some step:', err);
            console.error('Error code:', err.code);
            console.error('Error message:', err.message);
            setError('Failed to add patient: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const removePatient = async (patientId) => {
        if (!window.confirm('Remove this patient?')) return;
        try {
            await remove(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`));
            if (selectedPatient?.id === patientId) {
                onSelectPatient(null);
            }
            setSuccess('✅ Patient removed');
        } catch (err) {
            setError('Failed to remove patient: ' + err.message);
        }
    };

    return (
        <section className="patients-section">
            <h2>➕ Add Patient</h2>
            <form onSubmit={addPatient}>
                <div className="form-group">
                    <input
                        type="email"
                        placeholder="Patient Email"
                        value={newPatientEmail}
                        onChange={(e) => setNewPatientEmail(e.target.value)}
                        className="form-input"
                    />
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Adding...' : 'Add Patient'}
                    </button>
                </div>
            </form>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <h2>👥 Your Patients</h2>
            {patients.length === 0 ? (
                <p className="no-data">No patients added yet</p>
            ) : (
                <ul className="patients-list">
                    {patients.map(patient => (
                        <li
                            key={patient.id}
                            className={`patient-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                            onClick={() => onSelectPatient(patient)}
                        >
                            <div className="patient-info">
                                <strong>{patient.name}</strong>
                                <small>{patient.email}</small>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removePatient(patient.id);
                                }}
                                className="btn-remove"
                                title="Remove patient"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
