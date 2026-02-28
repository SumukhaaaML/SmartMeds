import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import { API_ENDPOINTS } from '../../config/constants';
import { patientStyles } from './styles/patient.styles';

export default function MedicineDisplay({ detectedMedicine, user }) {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!user?.uid) {
            console.log("MedicineDisplay: No user UID found", user);
            setLoading(false);
            return;
        }

        console.log(`MedicineDisplay: Fetching medicines for ${user.uid}`);

        try {
            const medicinesRef = ref(rtdb, `medicines/${user.uid}`);
            const unsubscribe = onValue(medicinesRef, (snapshot) => {
                const data = snapshot.val();
                if (snapshot.exists()) {
                    console.log("MedicineDisplay: Data received", Object.keys(data).length);
                    const medicineList = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));

                    // Sort by scheduled time if available
                    medicineList.sort((a, b) => {
                        if (a.scheduledTime && b.scheduledTime) {
                            return a.scheduledTime.localeCompare(b.scheduledTime);
                        }
                        return 0;
                    });

                    setMedicines(medicineList);
                } else {
                    console.log("MedicineDisplay: No medicines found in DB");
                    setMedicines([]);
                }
                setLoading(false);
            }, (error) => {
                console.error("MedicineDisplay: Error fetching data", error);
                setLoading(false);
                Alert.alert("Error", "Failed to fetch medicines: " + error.message);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("MedicineDisplay: Setup error", error);
            setLoading(false);
        }
    }, [user]);

    async function sendInstruction(medicineName, dosage) {
        try {
            setSending(true);
            const resp = await fetch(API_ENDPOINTS.SEND_INSTRUCTION, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    medicine_name: medicineName,
                    patient_uid: user.uid,
                    dosage: dosage || '',
                    action: 'dispense'
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                Alert.alert('Success', `${medicineName} ready to dispense from slot ${data.slot}!`);
            } else {
                Alert.alert('Failed', data.error || 'Could not send instruction');
            }
        } catch (err) {
            console.error('sendInstruction error', err);
            Alert.alert('Network Error', 'Could not connect to backend');
        } finally {
            setSending(false);
        }
    }

    const getTimeBadgeColor = (time) => {
        switch (time) {
            case 'morning': return ['#f093fb', '#f5576c'];
            case 'afternoon': return ['#fdd819', '#e08a1e'];
            case 'evening': return ['#667eea', '#764ba2'];
            case 'night': return ['#4834d4', '#341f97'];
            default: return ['#a8edea', '#fed6e3'];
        }
    };

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'pending': return ['#FFA800', '#FF6B00'];
            case 'ready_to_dispense': return ['#00b09b', '#96c93d'];
            case 'dispensing': return ['#4834d4', '#686de0'];
            case 'dispensed': return ['#11998e', '#38ef7d'];
            default: return ['#e0eafc', '#cfdef3'];
        }
    };

    return (
        <>
            {/* Detection Result */}
            {detectedMedicine && (
                <View style={patientStyles.statusCard}>
                    <Text style={patientStyles.cardTitle}>🎙️ Voice Command</Text>
                    <View style={patientStyles.detectionResult}>
                        <View style={patientStyles.detectionRow}>
                            <Text style={patientStyles.detectionLabel}>Medicine Identified</Text>
                            <Text style={patientStyles.detectionValue}>
                                {detectedMedicine.medicine_name || 'None detected'}
                            </Text>
                        </View>
                        {detectedMedicine.dosage && (
                            <View style={[patientStyles.detectionRow, { borderBottomWidth: 0 }]}>
                                <Text style={patientStyles.detectionLabel}>Recommended Dosage</Text>
                                <Text style={patientStyles.detectionValue}>{detectedMedicine.dosage}</Text>
                            </View>
                        )}
                    </View>
                    {detectedMedicine.medicine_name && (
                        <TouchableOpacity
                            style={patientStyles.quickDispenseBtn}
                            onPress={() => sendInstruction(detectedMedicine.medicine_name, detectedMedicine.dosage)}
                            disabled={sending}
                        >
                            <LinearGradient
                                colors={['#00b09b', '#96c93d']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={patientStyles.quickDispenseGradient}
                            >
                                <Text style={patientStyles.quickDispenseText}>
                                    {sending ? 'Processing...' : 'Dispense Now'}
                                </Text>
                                <Ionicons name="flash" size={22} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* My Medicines List */}
            <View style={patientStyles.glassCard}>
                <Text style={patientStyles.cardTitle}>💊 My Prescription</Text>

                {loading ? (
                    <View style={{ padding: 20 }}>
                        <ActivityIndicator size="large" color="#667eea" />
                        <Text style={{ textAlign: 'center', marginTop: 10, color: '#666' }}>Fetching your medicines...</Text>
                    </View>
                ) : medicines.length === 0 ? (
                    <View style={patientStyles.emptyState}>
                        <Ionicons name="medical-outline" size={64} color="#cbd5e0" />
                        <Text style={patientStyles.emptyText}>No medicines assigned yet</Text>
                        <Text style={{ textAlign: 'center', color: '#a0aec0', marginTop: 8, fontSize: 13 }}>
                            Your caregiver will add medicines here
                        </Text>
                    </View>
                ) : (
                    <View style={patientStyles.medicinesList}>
                        {medicines.map((med) => (
                            <View key={med.id} style={patientStyles.medicineCard}>
                                <View style={patientStyles.medicineHeader}>
                                    <Text style={patientStyles.medicineName}>{med.name}</Text>
                                    <View style={patientStyles.slotBadge}>
                                        <Ionicons name="hardware-chip-outline" size={14} color="#1967d2" />
                                        <Text style={patientStyles.slotText}>Slot {med.slot}</Text>
                                    </View>
                                </View>

                                {med.dosage && (
                                    <Text style={patientStyles.medicineDosage}>
                                        <Ionicons name="eyedrop-outline" size={14} color="#636e72" /> {med.dosage}
                                        {med.scheduledTime ? ` • ⏰ ${med.scheduledTime}` : ''}
                                    </Text>
                                )}

                                <View style={patientStyles.medicineBadges}>
                                    {med.time && (
                                        <LinearGradient
                                            colors={getTimeBadgeColor(med.time)}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={patientStyles.badge}
                                        >
                                            <Text style={patientStyles.badgeText}>
                                                {med.time.charAt(0).toUpperCase() + med.time.slice(1)}
                                            </Text>
                                        </LinearGradient>
                                    )}

                                    {med.status && (
                                        <LinearGradient
                                            colors={getStatusBadgeColor(med.status)}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={patientStyles.badge}
                                        >
                                            <Text style={patientStyles.badgeText}>
                                                {med.status.replace('_', ' ')}
                                            </Text>
                                        </LinearGradient>
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={patientStyles.dispenseSmallBtn}
                                    onPress={() => sendInstruction(med.name, med.dosage)}
                                    disabled={sending}
                                >
                                    <Text style={patientStyles.dispenseSmallText}>Manual Dispense</Text>
                                    <Ionicons name="chevron-forward-circle" size={20} color="#4834d4" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </>
    );
}
