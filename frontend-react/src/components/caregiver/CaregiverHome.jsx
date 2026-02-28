import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import './styles/caregiver-home.css';

export default function CaregiverHome({ user, onNavigate, onLogout }) {
    const [stats, setStats] = useState({
        totalPatients: 0,
        activeMedications: 0,
        pendingAlerts: 0
    });
    const [recentPatients, setRecentPatients] = useState([]);

    useEffect(() => {
        // Load patient statistics
        const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
        onValue(patientsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const patientList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));

                setStats(prev => ({
                    ...prev,
                    totalPatients: patientList.length
                }));

                // Get 3 most recent patients
                const sorted = patientList
                    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
                    .slice(0, 3);
                setRecentPatients(sorted);
            }
        }, { onlyOnce: true });

        // Load medicine stock count for active medications
        const stockRef = ref(rtdb, `medicineStock/${user.uid}`);
        const unsubscribeStock = onValue(stockRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const count = Object.keys(data).length;
                setStats(prev => ({
                    ...prev,
                    activeMedications: count
                }));
            } else {
                setStats(prev => ({
                    ...prev,
                    activeMedications: 0
                }));
            }
        });

        // Load alerts count from RTDB
        const alertsRef = ref(rtdb, `caregivers/${user.uid}/alerts`);
        onValue(alertsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setStats(prev => ({
                    ...prev,
                    pendingAlerts: Object.keys(data).length
                }));
            }
        }, { onlyOnce: true });

        // Cleanup function
        return () => {
            unsubscribeStock();
        };
    }, [user.uid]);

    const statCards = [
        {
            value: stats.totalPatients,
            label: 'Total Patients',
            color: '#667eea'
        },
        {
            value: stats.activeMedications,
            label: 'Active Medications',
            color: '#06d6a0'
        },
        {
            value: stats.pendingAlerts,
            label: 'Pending Alerts',
            color: '#f5576c'
        }
    ];

    const quickActions = [
        {
            title: 'Manage Patients',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            view: 'patients'
        },
        {
            title: 'Medicine Stock',
            gradient: 'linear-gradient(135deg, #06d6a0 0%, #1de4b1 100%)',
            view: 'stock'
        },
        {
            title: 'View Alerts',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            view: 'alerts'
        }
    ];

    return (
        <div className="caregiver-home">
            {/* Header Section */}
            <div className="caregiver-home-header animate-fadeIn">
                <div className="header-content">
                    <h1 className="header-title">
                        Caregiver Dashboard
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{user?.email}</div>
                        <button
                            onClick={onLogout}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#f5576c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#e04555'}
                            onMouseLeave={(e) => e.target.style.background = '#f5576c'}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistics Overview */}
            <div className="stats-section">
                <h2 className="section-title">Dashboard Overview</h2>
                <div className="stats-grid">
                    {statCards.map((stat, index) => (
                        <div
                            key={stat.label}
                            className="stat-card-home animate-slideUp"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="stat-card-content">
                                <div className="stat-card-value">{stat.value}</div>
                                <div className="stat-card-label">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="quick-actions-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                    {quickActions.map((action, index) => (
                        <div
                            key={action.view}
                            className="quick-action-card animate-scaleIn"
                            style={{
                                animationDelay: `${(index + 0.2) * 0.1}s`,
                                background: action.gradient
                            }}
                            onClick={() => onNavigate(action.view)}
                        >
                            <h3 className="quick-action-title">{action.title}</h3>
                            <div className="quick-action-arrow">→</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            {recentPatients.length > 0 && (
                <div className="recent-activity-section animate-slideUp">
                    <h2 className="section-title">Recent Patients</h2>
                    <div className="recent-patients-list">
                        {recentPatients.map((patient, index) => (
                            <div
                                key={patient.id}
                                className="recent-patient-item"
                                style={{ animationDelay: `${(index + 0.5) * 0.1}s` }}
                            >
                                <div className="patient-avatar">
                                    {patient.name?.charAt(0).toUpperCase() || 'P'}
                                </div>
                                <div className="patient-info">
                                    <div className="patient-name">{patient.name}</div>
                                    <div className="patient-email">{patient.email}</div>
                                </div>
                                <div className="patient-date">
                                    {new Date(patient.addedAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Get Started CTA (if no patients) */}
            {stats.totalPatients === 0 && (
                <div className="empty-state animate-scaleIn">
                    <h3 className="empty-state-title">Get Started</h3>
                    <button
                        className="empty-state-button"
                        onClick={() => onNavigate('patients')}
                    >
                        Add Patient
                    </button>
                </div>
            )}
        </div>
    );
}
