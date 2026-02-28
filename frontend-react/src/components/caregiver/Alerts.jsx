import { useState, useEffect } from 'react';
import { rtdb } from '../../config/firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import './styles/alerts.css';

export default function Alerts({ user }) {
    const [alerts, setAlerts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterPatient, setFilterPatient] = useState('all');
    const [patients, setPatients] = useState({});

    useEffect(() => {
        // Load patients first
        const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
        onValue(patientsRef, (snapshot) => {
            if (snapshot.exists()) {
                const patientsData = snapshot.val();
                setPatients(patientsData);
                const patientIds = Object.keys(patientsData);

                // Listen to alerts for each patient
                patientIds.forEach(pid => {
                    const alertRef = ref(rtdb, `alerts/${pid}`);
                    onValue(alertRef, (alertSnap) => {
                        if (alertSnap.exists()) {
                            const alertData = alertSnap.val();
                            const newAlerts = Object.keys(alertData).map(key => ({
                                id: key,
                                patientId: pid,
                                patientName: patientsData[pid].name,
                                ...alertData[key],
                                priority: determinePriority(alertData[key]),
                                acknowledged: alertData[key].acknowledged || false,
                                snoozedUntil: alertData[key].snoozedUntil || null
                            }));

                            setAlerts(prev => {
                                // Merge and dedup
                                const otherAlerts = prev.filter(a => a.patientId !== pid);
                                const combined = [...otherAlerts, ...newAlerts];
                                return combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                            });
                        }
                    });
                });
            }
        });
    }, [user.uid]);

    // Determine priority based on alert data
    const determinePriority = (alert) => {
        if (alert.type === 'missed' || alert.critical) return 'high';
        if (alert.type === 'upcoming') return 'medium';
        return 'low';
    };

    // Filter alerts
    const filteredAlerts = alerts.filter(alert => {
        // Skip snoozed alerts
        if (alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date()) {
            return false;
        }

        // Search filter
        const searchMatch = searchQuery === '' ||
            alert.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            alert.medicine.toLowerCase().includes(searchQuery.toLowerCase());

        // Priority filter
        const priorityMatch = filterPriority === 'all' || alert.priority === filterPriority;

        // Patient filter
        const patientMatch = filterPatient === 'all' || alert.patientId === filterPatient;

        return searchMatch && priorityMatch && patientMatch;
    });

    // Calculate stats
    const stats = {
        total: filteredAlerts.length,
        high: filteredAlerts.filter(a => a.priority === 'high').length,
        medium: filteredAlerts.filter(a => a.priority === 'medium').length,
        low: filteredAlerts.filter(a => a.priority === 'low').length,
        acknowledged: filteredAlerts.filter(a => a.acknowledged).length
    };

    // Dismiss alert
    const dismissAlert = async (patientId, alertId) => {
        try {
            await remove(ref(rtdb, `alerts/${patientId}/${alertId}`));
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (e) {
            console.error('Failed to dismiss', e);
        }
    };

    // Snooze alert for X minutes
    const snoozeAlert = async (patientId, alertId, minutes) => {
        try {
            const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
            await set(ref(rtdb, `alerts/${patientId}/${alertId}/snoozedUntil`), snoozedUntil);
            setAlerts(prev => prev.map(a =>
                a.id === alertId ? { ...a, snoozedUntil } : a
            ));
        } catch (e) {
            console.error('Failed to snooze', e);
        }
    };

    // Acknowledge alert
    const acknowledgeAlert = async (patientId, alertId) => {
        try {
            await set(ref(rtdb, `alerts/${patientId}/${alertId}/acknowledged`), true);
            setAlerts(prev => prev.map(a =>
                a.id === alertId ? { ...a, acknowledged: true } : a
            ));
        } catch (e) {
            console.error('Failed to acknowledge', e);
        }
    };

    // Format relative time
    const formatRelativeTime = (timestamp) => {
        const now = new Date();
        const alertTime = new Date(timestamp);
        const diffMs = now - alertTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return alertTime.toLocaleDateString();
    };

    // Get priority info
    const getPriorityInfo = (priority) => {
        const info = {
            high: { icon: '🔴', label: 'High Priority', color: '#ef476f' },
            medium: { icon: '🟡', label: 'Medium Priority', color: '#ffd166' },
            low: { icon: '🔵', label: 'Low Priority', color: '#4cc9f0' }
        };
        return info[priority] || info.low;
    };

    return (
        <div className="alerts-page">
            {/* Header with Stats */}
            <div className="alerts-header">
                <h2 className="alerts-title">🔔 Medication Alerts</h2>
                <div className="alerts-stats">
                    <div className="stat-badge">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total</span>
                    </div>
                    <div className="stat-badge high">
                        <span className="stat-value">{stats.high}</span>
                        <span className="stat-label">High</span>
                    </div>
                    <div className="stat-badge medium">
                        <span className="stat-value">{stats.medium}</span>
                        <span className="stat-label">Medium</span>
                    </div>
                    <div className="stat-badge low">
                        <span className="stat-value">{stats.low}</span>
                        <span className="stat-label">Low</span>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="alerts-controls">
                <input
                    type="text"
                    className="search-input"
                    placeholder="🔍 Search by patient or medicine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="filter-chips">
                    <select
                        className="filter-select"
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                    >
                        <option value="all">All Priorities</option>
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                    </select>
                    <select
                        className="filter-select"
                        value={filterPatient}
                        onChange={(e) => setFilterPatient(e.target.value)}
                    >
                        <option value="all">All Patients</option>
                        {Object.keys(patients).map(pid => (
                            <option key={pid} value={pid}>{patients[pid].name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Alerts List */}
            {filteredAlerts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">✨</div>
                    <h3 className="empty-title">All Clear!</h3>
                    <p className="empty-description">
                        {alerts.length === 0
                            ? "No alerts at the moment. You're doing great!"
                            : "No alerts match your current filters."}
                    </p>
                </div>
            ) : (
                <div className="alerts-list">
                    {filteredAlerts.map(alert => {
                        const priorityInfo = getPriorityInfo(alert.priority);
                        return (
                            <div
                                key={alert.id}
                                className={`alert-card priority-${alert.priority} ${alert.acknowledged ? 'acknowledged' : ''}`}
                            >
                                <div className="alert-priority-badge" style={{ background: priorityInfo.color }}>
                                    {priorityInfo.icon}
                                </div>

                                <div className="alert-content">
                                    <div className="alert-header">
                                        <h4 className="alert-patient">{alert.patientName}</h4>
                                        <span className="alert-time" title={new Date(alert.timestamp).toLocaleString()}>
                                            {formatRelativeTime(alert.timestamp)}
                                        </span>
                                    </div>

                                    <div className="alert-details">
                                        <span className="alert-medicine">💊 {alert.medicine}</span>
                                        {alert.dosage && <span className="alert-dosage">({alert.dosage})</span>}
                                    </div>

                                    {alert.acknowledged && (
                                        <div className="acknowledged-badge">✓ Acknowledged</div>
                                    )}
                                </div>

                                <div className="alert-actions">
                                    {!alert.acknowledged && (
                                        <>
                                            <button
                                                className="action-btn acknowledge"
                                                onClick={() => acknowledgeAlert(alert.patientId, alert.id)}
                                                title="Acknowledge"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                className="action-btn snooze"
                                                onClick={() => snoozeAlert(alert.patientId, alert.id, 30)}
                                                title="Snooze 30 min"
                                            >
                                                ⏰
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="action-btn dismiss"
                                        onClick={() => dismissAlert(alert.patientId, alert.id)}
                                        title="Dismiss"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
