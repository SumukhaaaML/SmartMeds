import { useState, useEffect } from 'react';
import { rtdb } from './firebase';
import { ref, onValue, remove } from 'firebase/database';
import './caregiver.css';

export default function Alerts({ user }) {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribers = [];

        // Listen for alerts for this caregiver's patients
        const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
        const unsubscribePatients = onValue(patientsRef, (snapshot) => {
            if (snapshot.exists()) {
                const patients = snapshot.val();
                const patientIds = Object.keys(patients);

                // Clear old alerts when patients list changes
                setAlerts([]);

                // Listen to alerts for each patient
                patientIds.forEach(pid => {
                    const alertRef = ref(rtdb, `alerts/${pid}`);
                    const unsubscribeAlert = onValue(alertRef, (alertSnap) => {
                        if (alertSnap.exists()) {
                            const alertData = alertSnap.val();
                            const newAlerts = Object.keys(alertData).map(key => ({
                                id: key,
                                patientId: pid,
                                patientName: patients[pid]?.name || 'Unknown Patient',
                                ...alertData[key]
                            }));

                            setAlerts(prev => {
                                // Remove old alerts from this patient and add new ones
                                const filtered = prev.filter(a => a.patientId !== pid);
                                const combined = [...filtered, ...newAlerts];
                                return combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                            });
                        } else {
                            // No alerts for this patient, remove them from state
                            setAlerts(prev => prev.filter(a => a.patientId !== pid));
                        }
                    });
                    unsubscribers.push(unsubscribeAlert);
                });
            } else {
                setAlerts([]);
            }
        });

        // Cleanup function
        return () => {
            unsubscribePatients();
            unsubscribers.forEach(unsub => unsub());
        };
    }, [user?.uid]);

    const dismissAlert = async (patientId, alertId) => {
        try {
            await remove(ref(rtdb, `alerts/${patientId}/${alertId}`));
            setAlerts(prev => prev.filter(a => a.id !== alertId));
        } catch (e) {
            console.error("Failed to dismiss alert:", e);
        }
    };

    if (alerts.length === 0) return null;

    return (
        <div className="alerts-section">
            <h3>Recent Alerts</h3>
            <ul className="alerts-list">
                {alerts.map(alert => (
                    <li key={alert.id} className="alert-item">
                        <div className="alert-content">
                            <strong>{alert.patientName}</strong>
                            <span>Needs {alert.medicine} ({alert.dosage})</span>
                            <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
                        </div>
                        <button onClick={() => dismissAlert(alert.patientId, alert.id)} className="btn-dismiss">Dismiss</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
