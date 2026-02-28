import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firebaseConfig } from '../../config/firebase';
import { patientStyles } from './styles/patient.styles';
import { sendLocalNotification } from '../../services/NotificationService';

export default function PatientAlerts({ user }) {
    const [alerts, setAlerts] = useState([]);
    const lastAlertTimestamp = useRef(Date.now());

    useEffect(() => {
        if (!user?.uid) return;

        // Load alerts instantly
        loadAlerts();

        // Poll for alerts every 10 seconds (faster for better responsiveness)
        const interval = setInterval(loadAlerts, 10000);
        return () => clearInterval(interval);
    }, [user?.uid]);

    async function loadAlerts() {
        try {
            const response = await fetch(
                `${firebaseConfig.databaseURL}/alerts/${user.uid}.json`
            );
            const alertsData = await response.json();

            if (!alertsData) {
                setAlerts([]);
                return;
            }

            const alertsList = Object.keys(alertsData).map(key => ({
                id: key,
                ...alertsData[key]
            }));

            // Sort by timestamp (newest first)
            alertsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Check for new alerts to notify
            alertsList.forEach(alert => {
                const alertTime = new Date(alert.timestamp).getTime();
                // If alert is newer than our last check AND not read
                if (alertTime > lastAlertTimestamp.current && !alert.read) {

                    // Send system notification
                    let title = 'New Alert';
                    let body = 'You have a new medication alert';

                    if (alert.type === 'medication_due') {
                        title = 'Medication Due';
                        body = `Time to take ${alert.medicineName}`;
                    } else if (alert.type === 'medication_missed') {
                        title = 'Missed Medication';
                        body = `You missed ${alert.medicineName}`;
                    }

                    sendLocalNotification(title, body, { type: alert.type });

                    // Update timestamp to avoid re-notifying this one
                    lastAlertTimestamp.current = alertTime;
                }
            });

            // Filter out old read alerts (show only last 10)
            const recentAlerts = alertsList.filter(a => !a.read).slice(0, 10);
            setAlerts(recentAlerts);
        } catch (err) {
            console.error('Failed to load patient alerts:', err);
        }
    }

    async function markAsRead(alertId) {
        try {
            await fetch(
                `${firebaseConfig.databaseURL}/alerts/${user.uid}/${alertId}.json`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ read: true })
                }
            );
            // Remove from display
            setAlerts(alerts.filter(a => a.id !== alertId));
        } catch (err) {
            console.error('Failed to mark alert as read:', err);
        }
    }

    const getAlertIcon = (type) => {
        switch (type) {
            case 'medication_missed':
                return { name: 'alert-circle', color: '#e74c3c' };
            case 'medication_due':
                return { name: 'time', color: '#f39c12' };
            default:
                return { name: 'notifications', color: '#3498db' };
        }
    };

    const getAlertMessage = (item) => {
        if (item.type === 'medication_missed') {
            return `You missed ${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''} scheduled at ${item.scheduledTime}`;
        } else if (item.type === 'medication_due') {
            return `Time to take ${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''}`;
        }
        return item.medicineName || item.medicine || 'Medication reminder';
    };

    if (alerts.length === 0) {
        return null;
    }

    return (
        <View style={patientStyles.statusCard}>
            <Text style={patientStyles.cardTitle}>Notifications</Text>
            {alerts.map((item) => {
                const icon = getAlertIcon(item.type);
                return (
                    <View key={item.id} style={{
                        flexDirection: 'row',
                        backgroundColor: item.type === 'medication_missed' ? '#fee' : '#fef9e6',
                        padding: 14,
                        borderRadius: 12,
                        marginBottom: 10,
                        borderLeftWidth: 4,
                        borderLeftColor: icon.color
                    }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <Ionicons name={icon.name} size={18} color={icon.color} style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2d3436', flex: 1 }}>
                                    {item.type === 'medication_missed' ? 'Missed Medicine' : 'Medicine Due'}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 13, color: '#636e72', marginBottom: 4 }}>
                                {getAlertMessage(item)}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#999' }}>
                                {new Date(item.timestamp).toLocaleString()}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => markAsRead(item.id)}
                            style={{
                                backgroundColor: '#20bf6b',
                                borderRadius: 8,
                                padding: 8,
                                marginLeft: 8,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
}
