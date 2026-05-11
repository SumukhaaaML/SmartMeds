import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import * as Notifications from 'expo-notifications';
import { rtdb } from '../../config/firebase';
import { API_ENDPOINTS } from '../../config/constants';
import { patientStyles } from './styles/patient.styles';
import { refreshMedicineSchedule } from '../../services/NotificationScheduler';

const DAY_ABBREVS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const TIME_SLOT_META = {
    morning:   { icon: '🌅', label: 'Morning',   colors: ['#f7971e', '#ffd200'] },
    afternoon: { icon: '☀️',  label: 'Afternoon', colors: ['#f953c6', '#b91d73'] },
    evening:   { icon: '🌆', label: 'Evening',   colors: ['#4facfe', '#00f2fe'] },
    night:     { icon: '🌙', label: 'Night',     colors: ['#a18cd1', '#fbc2eb'] },
    custom:    { icon: '⏰', label: 'Custom',    colors: ['#b2bec3', '#808e9b'] },
};

function todayAbbrev() {
    return DAY_ABBREVS[new Date().getDay()];
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function slotIsToday(slot) {
    if (slot.scheduledDate) return slot.scheduledDate === todayStr();
    if (slot.dayOfWeek) {
        const days = Array.isArray(slot.dayOfWeek)
            ? slot.dayOfWeek
            : Object.values(slot.dayOfWeek);
        return days.map(d => d.toLowerCase()).includes(todayAbbrev());
    }
    return true;
}

export default function MedicineDisplay({ detectedMedicine, user }) {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Request notification permissions once on mount
    useEffect(() => {
        Notifications.requestPermissionsAsync().then(({ status }) => {
            if (status !== 'granted') {
                console.warn('MedicineDisplay: notification permission not granted');
            }
        });
    }, []);

    useEffect(() => {
        if (!user?.uid) { setLoading(false); return; }

        const slotsRef = ref(rtdb, `slots/${user.uid}`);
        const unsubscribe = onValue(slotsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(key => ({ id: key, ...data[key] }))
                    .filter(slotIsToday)
                    .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
                setSlots(list);
                // Schedule local reminders for all pending slots
                refreshMedicineSchedule(list).catch(console.warn);
            } else {
                setSlots([]);
                refreshMedicineSchedule([]).catch(console.warn);
            }
            setLoading(false);
        }, (err) => {
            console.error('MedicineDisplay: error', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    async function sendInstruction(slotData) {
        try {
            setSending(true);
            const resp = await fetch(API_ENDPOINTS.SEND_INSTRUCTION, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slot_id:      slotData.id,
                    patient_uid:  user.uid,
                    notes:        slotData.notes || '',
                    action:       'dispense'
                })
            });
            const data = await resp.json();
            if (resp.ok) {
                Alert.alert('Success', 'Medicine ready to dispense!');
            } else {
                Alert.alert('Failed', data.error || 'Could not send instruction');
            }
        } catch (err) {
            Alert.alert('Network Error', 'Could not connect to backend');
        } finally {
            setSending(false);
        }
    }

    async function sendDetectedMedicine(medicineName, dosage) {
        try {
            setSending(true);
            const resp = await fetch(API_ENDPOINTS.SEND_INSTRUCTION, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    medicine_name: medicineName,
                    patient_uid:   user.uid,
                    dosage:        dosage || '',
                    action:        'dispense'
                })
            });
            const data = await resp.json();
            if (resp.ok) {
                Alert.alert('Success', `${medicineName} ready to dispense!`);
            } else {
                Alert.alert('Failed', data.error || 'Could not send instruction');
            }
        } catch (err) {
            Alert.alert('Network Error', 'Could not connect to backend');
        } finally {
            setSending(false);
        }
    }

    const statusColors = {
        pending:           ['#FFA800', '#FF6B00'],
        ready_to_dispense: ['#00b09b', '#96c93d'],
        dispensed:         ['#11998e', '#38ef7d'],
        missed:            ['#ee5253', '#ff6b6b'],
    };

    return (
        <>
            {/* ── Voice detection result ─────────────────────────────────── */}
            {detectedMedicine && (
                <View style={patientStyles.statusCard}>
                    <Text style={patientStyles.cardTitle}>🎙️ Voice Command</Text>

                    {detectedMedicine.batch_command ? (
                        <View style={{ padding: 8 }}>
                            <Text style={{ color: '#2d3436', fontWeight: '700', fontSize: 15 }}>
                                {detectedMedicine.time_category
                                    ? `"${detectedMedicine.time_category.charAt(0).toUpperCase() + detectedMedicine.time_category.slice(1)} medicines"`
                                    : 'All medicines today'}
                            </Text>
                            {detectedMedicine.auto_dispensed ? (
                                <Text style={{ color: '#00b09b', marginTop: 4 }}>
                                    ✅ Auto-dispensed {detectedMedicine.dispensed_count} slot(s)
                                </Text>
                            ) : (
                                <Text style={{ color: '#636e72', marginTop: 4 }}>
                                    Batch command detected — tap dispense below
                                </Text>
                            )}
                        </View>
                    ) : (
                        <View style={patientStyles.detectionResult}>
                            <View style={patientStyles.detectionRow}>
                                <Text style={patientStyles.detectionLabel}>Medicine Identified</Text>
                                <Text style={patientStyles.detectionValue}>
                                    {detectedMedicine.medicine_name ||
                                     (detectedMedicine.medicines || []).join(', ') ||
                                     'None detected'}
                                </Text>
                            </View>
                            {detectedMedicine.dosage && (
                                <View style={[patientStyles.detectionRow, { borderBottomWidth: 0 }]}>
                                    <Text style={patientStyles.detectionLabel}>Dosage</Text>
                                    <Text style={patientStyles.detectionValue}>{detectedMedicine.dosage}</Text>
                                </View>
                            )}
                            {detectedMedicine.notes ? (
                                <View style={[patientStyles.detectionRow, { borderBottomWidth: 0 }]}>
                                    <Text style={patientStyles.detectionLabel}>Notes</Text>
                                    <Text style={[patientStyles.detectionValue, { color: '#6c5ce7', fontStyle: 'italic' }]}>
                                        {detectedMedicine.notes}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}

                    {!detectedMedicine.auto_dispensed && (detectedMedicine.medicine_name || detectedMedicine.medicines) && (
                        <TouchableOpacity
                            style={patientStyles.quickDispenseBtn}
                            onPress={() =>
                                sendDetectedMedicine(
                                    detectedMedicine.medicine_name || (detectedMedicine.medicines || [])[0],
                                    detectedMedicine.dosage
                                )
                            }
                            disabled={sending}
                        >
                            <LinearGradient
                                colors={['#00b09b', '#96c93d']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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

            {/* ── Today's Slots ──────────────────────────────────────────── */}
            <View style={patientStyles.glassCard}>
                <Text style={patientStyles.cardTitle}>💊 Today's Schedule</Text>

                {loading ? (
                    <View style={{ padding: 20 }}>
                        <ActivityIndicator size="large" color="#667eea" />
                        <Text style={{ textAlign: 'center', marginTop: 10, color: '#666' }}>
                            Fetching your schedule...
                        </Text>
                    </View>
                ) : slots.length === 0 ? (
                    <View style={patientStyles.emptyState}>
                        <Ionicons name="medical-outline" size={64} color="#cbd5e0" />
                        <Text style={patientStyles.emptyText}>No medicines scheduled for today</Text>
                        <Text style={{ textAlign: 'center', color: '#a0aec0', marginTop: 8, fontSize: 13 }}>
                            Your caregiver will add slot schedules here
                        </Text>
                    </View>
                ) : (
                    <View style={patientStyles.medicinesList}>
                        {slots.map(slot => {
                            const tsInfo = TIME_SLOT_META[slot.timeSlot] || { icon: '⏰', label: 'Schedule', colors: ['#b2bec3', '#808e9b'] };
                            const isDispensed = slot.status === 'dispensed';
                            const isReady = slot.status === 'ready_to_dispense';
                            const isPending = !isDispensed && !isReady;

                            return (
                                <View key={slot.id} style={[patientStyles.medicineCard, isDispensed && dispStyles.dispensedCard]}>
                                    {/* Header row */}
                                    <View style={patientStyles.medicineHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <LinearGradient
                                                colors={tsInfo.colors}
                                                style={dispStyles.slotBadge}
                                            >
                                                <Text style={{ fontSize: 13 }}>{tsInfo.icon}</Text>
                                                <Text style={dispStyles.slotBadgeText}> {tsInfo.label}</Text>
                                            </LinearGradient>
                                            <Text style={dispStyles.time}>{slot.scheduledTime}</Text>
                                        </View>
                                        {/* Status badge */}
                                        <LinearGradient
                                            colors={statusColors[slot.status] || ['#b2bec3', '#808e9b']}
                                            style={dispStyles.statusBadge}
                                        >
                                            <Text style={dispStyles.statusText}>
                                                {(slot.status || 'pending').replace('_', ' ')}
                                            </Text>
                                        </LinearGradient>
                                    </View>

                                    {/* Dispensed banner */}
                                    {isDispensed && (
                                        <View style={dispStyles.dispensedBanner}>
                                            <Ionicons name="checkmark-circle" size={18} color="#2ed573" />
                                            <Text style={dispStyles.dispensedText}>Medicines dispensed ✓</Text>
                                        </View>
                                    )}
                                    {isReady && (
                                        <View style={dispStyles.readyBanner}>
                                            <Ionicons name="hourglass-outline" size={16} color="#00f2fe" />
                                            <Text style={dispStyles.readyText}>Dispensing in progress...</Text>
                                        </View>
                                    )}

                                    {/* Medicine chips */}
                                    <View style={dispStyles.chipsRow}>
                                        {(slot.medicines || []).map((m, i) => (
                                            <View key={i} style={[dispStyles.chip, isDispensed && dispStyles.chipDone]}>
                                                <Text style={[dispStyles.chipText, isDispensed && dispStyles.chipTextDone]}>{m}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Notes */}
                                    {slot.notes ? (
                                        <Text style={dispStyles.notes}>📝 {slot.notes}</Text>
                                    ) : null}

                                    {/* Dispense button — only show for pending slots */}
                                    {isPending && (
                                        <TouchableOpacity
                                            style={patientStyles.dispenseSmallBtn}
                                            onPress={() => sendInstruction(slot)}
                                            disabled={sending}
                                        >
                                            <Text style={patientStyles.dispenseSmallText}>Manual Dispense</Text>
                                            <Ionicons name="chevron-forward-circle" size={20} color="#4834d4" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </>
    );
}

const dispStyles = {
    slotBadge: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
        marginRight: 4,
    },
    slotBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    time: { fontSize: 13, color: '#636e72', fontWeight: '500' },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 6 },
    chip: { backgroundColor: '#edf2fb', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
    chipText: { color: '#4834d4', fontSize: 12, fontWeight: '600', flexWrap: 'wrap' },
    chipDone: { backgroundColor: 'rgba(46, 213, 115, 0.12)', borderWidth: 1, borderColor: 'rgba(46,213,115,0.3)' },
    chipTextDone: { color: '#2ed573' },
    notes: { fontSize: 12, color: '#6c5ce7', fontStyle: 'italic', marginTop: 4 },
    dispensedCard: { borderColor: 'rgba(46,213,115,0.25)', borderWidth: 1, backgroundColor: 'rgba(46,213,115,0.03)' },
    dispensedBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(46, 213, 115, 0.12)',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        marginBottom: 8, marginTop: 4,
    },
    dispensedText: { color: '#2ed573', fontWeight: '700', fontSize: 14 },
    readyBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0, 242, 254, 0.1)',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        marginBottom: 8, marginTop: 4,
    },
    readyText: { color: '#00f2fe', fontWeight: '700', fontSize: 14 },
};
