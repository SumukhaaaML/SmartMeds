import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../../config/firebase';
import { ref, get, child, remove } from 'firebase/database';
import { caregiverStyles } from './styles/caregiver.styles';

export default function Alerts({ user }) {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        // Poll for alerts every 30 seconds
        loadAlerts();
        const interval = setInterval(loadAlerts, 30000);
        return () => clearInterval(interval);
    }, [user.uid]);

    async function loadAlerts() {
        try {
            //Get alerts directly from caregiver's alerts node
            const caregiverAlertsSnapshot = await get(child(ref(rtdb), `alerts/${user.uid}`));

            const allAlerts = [];

            if (caregiverAlertsSnapshot.exists()) {
                const caregiverAlerts = caregiverAlertsSnapshot.val();
                Object.keys(caregiverAlerts).forEach(key => {
                    allAlerts.push({
                        id: key,
                        ...caregiverAlerts[key]
                    });
                });
            }

            // Get caregiver's patients for additional alerts
            const patientsSnapshot = await get(child(ref(rtdb), `caregivers/${user.uid}/patients`));

            if (patientsSnapshot.exists()) {
                const patients = patientsSnapshot.val();
                // Get alerts for each patient
                for (const patientId in patients) {
                    const alertsSnapshot = await get(child(ref(rtdb), `alerts/${patientId}`));

                    if (alertsSnapshot.exists()) {
                        const patientAlerts = alertsSnapshot.val();
                        Object.keys(patientAlerts).forEach(key => {
                            const alert = patientAlerts[key];
                            // Only show medication due and missed alerts
                            if (alert.type === 'medication_due' || alert.type === 'medication_missed') {
                                allAlerts.push({
                                    id: key,
                                    patientId,
                                    patientEmail: patients[patientId].email,
                                    ...alert
                                });
                            }
                        });
                    }
                }
            }

            // Sort by timestamp (newest first)
            allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setAlerts(allAlerts);
        } catch (err) {
            console.error('Failed to load alerts', err);
        }
    }

    async function dismissAlert(alertId, patientId = null) {
        try {
            const targetUid = patientId || user.uid;
            await remove(ref(rtdb, `alerts/${targetUid}/${alertId}`));
            // Optimistically remove
            setAlerts(alerts.filter(a => a.id !== alertId));
            // Reload to enable sync
            loadAlerts();
        } catch (err) {
            console.error('Failed to dismiss alert', err);
        }
    }

    const getAlertIcon = (type) => {
        switch (type) {
            case 'medication_missed':
                return 'alert-circle';
            case 'patient_missed_medication':
                return 'warning';
            case 'medication_due':
                return 'time';
            default:
                return 'notifications';
        }
    };

    const getAlertMessage = (item) => {
        if (item.type === 'patient_missed_medication') {
            return `${item.patientName} missed ${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''} at ${item.scheduledTime}`;
        } else if (item.type === 'medication_missed') {
            return `${item.patientEmail || 'Patient'} missed ${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''} at ${item.scheduledTime}`;
        } else if (item.type === 'medication_due') {
            return `${item.patientEmail || 'Patient'} - ${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''} is due`;
        }
        return `${item.medicineName || item.medicine || 'Medicine'}${item.dosage ? ` (${item.dosage})` : ''}`;
    };

    if (alerts.length === 0) {
        return null;
    }

    return (
        <View style={caregiverStyles.sectionCard}>
            <Text style={caregiverStyles.sectionTitle}>Recent Alerts</Text>
            {alerts.map((item) => (
                <View key={item.id} style={caregiverStyles.alertItem}>
                    <View style={caregiverStyles.alertContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Ionicons name={getAlertIcon(item.type)} size={16} color="#e67e22" style={{ marginRight: 6 }} />
                            <Text style={caregiverStyles.alertPatient}>
                                {item.patientName || item.patientEmail || 'Alert'}
                            </Text>
                        </View>
                        <Text style={caregiverStyles.alertMessage}>
                            {getAlertMessage(item)}
                        </Text>
                        <Text style={caregiverStyles.alertTime}>
                            {new Date(item.timestamp).toLocaleString()}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={caregiverStyles.dismissButton}
                        onPress={() => dismissAlert(item.id, item.patientId)}
                    >
                        <Ionicons name="checkmark" size={20} color="#2ed573" />
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
}
