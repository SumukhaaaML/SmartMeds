import { useState } from 'react';
import PatientHome from './PatientHome';
import AudioRecorder from './AudioRecorder';
import MedicineDisplay from './MedicineDisplay';
import Reminders from './Reminders';
import './styles/patient.css';

export default function PatientDashboard({ user, onLogout, medicines }) {
    const [showHome, setShowHome] = useState(false);
    const [detectedMedicine, setDetectedMedicine] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleDetection = (medicineData) => {
        setDetectedMedicine(medicineData);
    };

    const handleDispense = (medicineName, medicineDosage) => {
        // Add reminder after successful dispense
        const intervalHours = 8;
        if (window.addMedicineReminder) {
            window.addMedicineReminder(medicineName, medicineDosage, intervalHours);
        }
    };

    const handleNavigate = () => {
        setShowHome(false);
    };

    // Show home page first
    if (showHome) {
        return <PatientHome user={user} onNavigate={handleNavigate} onLogout={onLogout} />;
    }

    return (
        <div className="app-container">
            <div className="app-header">
                <h1>🎤 SmartMeds</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="user-info">{user?.email}</div>
                    <button className="sign-out-btn" onClick={() => setShowHome(true)}>
                        Home
                    </button>
                    <button className="sign-out-btn" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </div>

            <div className="app-content">
                <div className="app-card">
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <AudioRecorder
                        user={user}
                        onDetection={handleDetection}
                        setError={setError}
                        setSuccess={setSuccess}
                    />

                    <MedicineDisplay
                        detectedMedicine={detectedMedicine}
                        medicines={medicines}
                        onDispense={handleDispense}
                        setError={setError}
                        setSuccess={setSuccess}
                        user={user}
                    />

                    <Reminders setSuccess={setSuccess} />
                </div>
            </div>
        </div>
    );
}
