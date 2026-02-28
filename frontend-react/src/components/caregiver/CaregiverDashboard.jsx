import { useState, useEffect } from 'react';
import { rtdb } from '../../config/firebase';
import { ref, onValue } from 'firebase/database';
import CaregiverHome from './CaregiverHome';
import PatientList from './PatientList';
import MedicineManager from './MedicineManager';
import MedicineStock from './MedicineStock';
import Alerts from './Alerts';
import './styles/caregiver.css';

export default function CaregiverDashboard({ user, onLogout }) {
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [activeView, setActiveView] = useState('home'); // 'home', 'patients', 'stock', 'alerts'

    // Load caregiver's patients
    useEffect(() => {
        const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
        const unsubscribe = onValue(patientsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const patientList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setPatients(patientList);
            } else {
                setPatients([]);
            }
        });
        return unsubscribe;
    }, [user.uid]);

    const handleNavigate = (view) => {
        setActiveView(view);
    };

    // Show home page first
    if (activeView === 'home') {
        return <CaregiverHome user={user} onNavigate={handleNavigate} onLogout={onLogout} />;
    }

    return (
        <div className="caregiver-container">
            {/* Sidebar Navigation */}
            <aside className="caregiver-sidebar">
                <div className="sidebar-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1>
                                <span>🏥</span> SmartMeds
                            </h1>
                            <p title={user.email}>{user.email}</p>
                        </div>
                        <button
                            className="logout-btn-header"
                            onClick={onLogout}
                            title="Logout"
                        >
                            🚪
                        </button>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div
                        className={`nav-item ${activeView === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveView('home')}
                    >
                        <span className="nav-item-icon">🏠</span>
                        <span>Home</span>
                    </div>
                    <div
                        className={`nav-item ${activeView === 'patients' ? 'active' : ''}`}
                        onClick={() => setActiveView('patients')}
                    >
                        <span className="nav-item-icon">👥</span>
                        <span>Patients & Medicines</span>
                    </div>
                    <div
                        className={`nav-item ${activeView === 'stock' ? 'active' : ''}`}
                        onClick={() => setActiveView('stock')}
                    >
                        <span className="nav-item-icon">📦</span>
                        <span>Medicine Stock</span>
                    </div>
                    <div
                        className={`nav-item ${activeView === 'alerts' ? 'active' : ''}`}
                        onClick={() => setActiveView('alerts')}
                    >
                        <span className="nav-item-icon">🔔</span>
                        <span>Alerts</span>
                    </div>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="caregiver-main">
                {/* Patients & Medicines View */}
                {activeView === 'patients' && (
                    <>
                        <div className="content-header">
                            <h2>Patients & Medicines Management</h2>
                            <p>Add patients and manage their medication schedules</p>
                        </div>

                        <div className="caregiver-body">
                            <PatientList
                                user={user}
                                patients={patients}
                                setPatients={setPatients}
                                onSelectPatient={setSelectedPatient}
                                selectedPatient={selectedPatient}
                            />

                            <MedicineManager
                                selectedPatient={selectedPatient}
                                user={user}
                            />
                        </div>
                    </>
                )}

                {/* Medicine Stock View */}
                {activeView === 'stock' && (
                    <>
                        <div className="content-header">
                            <h2>Medicine Inventory</h2>
                            <p>Track medicine stock levels and expiry dates</p>
                        </div>
                        <MedicineStock user={user} />
                    </>
                )}

                {/* Alerts View */}
                {activeView === 'alerts' && (
                    <>
                        <div className="content-header">
                            <h2>Medication Alerts</h2>
                            <p>View and manage medication reminders for your patients</p>
                        </div>
                        <Alerts user={user} />
                    </>
                )}
            </main>
        </div>
    );
}
