import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import './styles/patient-home.css';

export default function PatientHome({ user, onNavigate, onLogout }) {
    const [stats, setStats] = useState({
        totalMedicines: 0,
        activeReminders: 0,
        todayDispenses: 0
    });
    const [recentMedicines, setRecentMedicines] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;

        // Load medicine count from Firebase
        const medicinesRef = ref(rtdb, `medicines/${user.uid}`);
        const unsubscribeMeds = onValue(medicinesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const medicineList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));

                setStats(prev => ({
                    ...prev,
                    totalMedicines: medicineList.length
                }));

                // Get 3 most recent medicines
                const sorted = medicineList
                    .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0))
                    .slice(0, 3);
                setRecentMedicines(sorted);

                // Count today's dispenses
                const today = new Date().toDateString();
                const todayDispenses = medicineList.filter(med =>
                    med.dispensedAt && new Date(med.dispensedAt).toDateString() === today
                ).length;

                setStats(prev => ({
                    ...prev,
                    todayDispenses
                }));
            } else {
                setStats(prev => ({ ...prev, totalMedicines: 0, todayDispenses: 0 }));
            }
        });

        // Load reminder count from localStorage
        try {
            const stored = localStorage.getItem('smartmeds_reminders') || '[]';
            const reminders = JSON.parse(stored);
            setStats(prev => ({
                ...prev,
                activeReminders: reminders.length
            }));
        } catch (e) {
            console.warn('Failed to load reminders', e);
        }

        return () => {
            unsubscribeMeds();
        };
    }, [user?.uid]);

    const statCards = [
        {
            value: stats.totalMedicines,
            label: 'My Medicines',
            color: '#667eea'
        },
        {
            value: stats.activeReminders,
            label: 'Active Reminders',
            color: '#06d6a0'
        },
        {
            value: stats.todayDispenses,
            label: 'Dispensed Today',
            color: '#f5576c'
        }
    ];

    const quickActions = [
        {
            title: 'Voice Recording',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            action: () => onNavigate()
        },
        {
            title: 'My Medicines',
            gradient: 'linear-gradient(135deg, #06d6a0 0%, #1de4b1 100%)',
            action: () => onNavigate()
        },
        {
            title: 'Reminders',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            action: () => onNavigate()
        }
    ];

    return (
        <div className="caregiver-home">
            {/* Header Section */}
            <div className="caregiver-home-header animate-fadeIn">
                <div className="header-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{user?.email}</div>
                    </div>
                    <h1 className="header-title">
                        Patient Dashboard
                    </h1>
                </div>
            </div>

            {/* Statistics Overview */}
            <div className="stats-section">
                <h2 className="section-title">Your Health Overview</h2>
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

            {/* Quick Actions */}
            <div className="quick-actions-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions-grid">
                    {quickActions.map((action, index) => (
                        <div
                            key={action.title}
                            className="quick-action-card animate-scaleIn"
                            style={{
                                animationDelay: `${(index + 0.2) * 0.1}s`,
                                background: action.gradient
                            }}
                            onClick={action.action}
                        >
                            <h3 className="quick-action-title">{action.title}</h3>
                            <div className="quick-action-arrow">→</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            {recentMedicines.length > 0 && (
                <div className="recent-activity-section animate-slideUp">
                    <h2 className="section-title">Recent Medicines</h2>
                    <div className="recent-patients-list">
                        {recentMedicines.map((medicine, index) => (
                            <div
                                key={medicine.id}
                                className="recent-patient-item"
                                style={{ animationDelay: `${(index + 0.5) * 0.1}s` }}
                            >
                                <div className="patient-avatar">
                                    {medicine.name?.charAt(0).toUpperCase() || 'M'}
                                </div>
                                <div className="patient-info">
                                    <div className="patient-name">{medicine.name}</div>
                                    <div className="patient-email">{medicine.dosage || 'No dosage specified'}</div>
                                </div>
                                <div className="patient-date">
                                    Slot {medicine.slot || '-'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Get Started CTA (if no medicines) */}
            {stats.totalMedicines === 0 && (
                <div className="empty-state animate-scaleIn">
                    <h3 className="empty-state-title">Get Started</h3>
                    <button
                        className="empty-state-button"
                        onClick={() => onNavigate()}
                    >
                        Start Voice Recording
                    </button>
                </div>
            )}
        </div>
    );
}
