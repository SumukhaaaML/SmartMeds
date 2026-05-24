import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    Alert, Switch, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../../config/firebase';
import { ref, get, child, push, set, remove } from 'firebase/database';
import { caregiverStyles } from './styles/caregiver.styles';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su' };

const TIME_SLOTS = [
    { key: 'morning',   label: 'Morning',   icon: '🌅', time: '08:00', colors: ['#f7971e', '#ffd200'] },
    { key: 'afternoon', label: 'Afternoon',  icon: '☀️', time: '13:00', colors: ['#f953c6', '#b91d73'] },
    { key: 'evening',   label: 'Evening',    icon: '🌆', time: '18:00', colors: ['#4facfe', '#00f2fe'] },
    { key: 'night',     label: 'Night',      icon: '🌙', time: '21:00', colors: ['#a18cd1', '#fbc2eb'] },
];

export default function MedicineManager({ selectedPatient, user }) {
    const [slots, setSlots] = useState([]);

    // ── form state ────────────────────────────────────────────────────────────
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);  // key: morning/afternoon/evening/night
    const [customTime, setCustomTime] = useState('');
    const [useCustomTime, setUseCustomTime] = useState(false);
    const [medicines, setMedicines] = useState(['']);
    const [scheduledDate, setScheduledDate] = useState('');
    const [selectedDays, setSelectedDays] = useState(DAYS);
    const [useDateMode, setUseDateMode] = useState(false);
    const [notes, setNotes] = useState('');
    const [dispense, setDispense] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (selectedPatient) loadSlots();
        else setSlots([]);
    }, [selectedPatient]);

    async function loadSlots() {
        try {
            const snapshot = await get(child(ref(rtdb), `slots/${selectedPatient.id}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                // Sort by time slot order
                const order = { morning: 0, afternoon: 1, evening: 2, night: 3 };
                list.sort((a, b) => {
                    const aOrd = order[a.timeSlot] ?? 99;
                    const bOrd = order[b.timeSlot] ?? 99;
                    if (aOrd !== bOrd) return aOrd - bOrd;
                    return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
                });
                setSlots(list);
            } else {
                setSlots([]);
            }
        } catch (err) {
            console.error('Failed to load slots', err);
        }
    }

    function toggleDay(d) {
        setSelectedDays(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
        );
    }
    function updateMedicine(idx, val) {
        const updated = [...medicines];
        updated[idx] = val;
        setMedicines(updated);
    }
    function addMedicineField() { setMedicines([...medicines, '']); }
    function removeMedicineField(idx) { setMedicines(medicines.filter((_, i) => i !== idx)); }

    async function addSlot() {
        setError(''); setSuccess('');
        if (!selectedPatient) { setError('Select a patient first'); return; }
        if (!selectedTimeSlot && !useCustomTime) { setError('Choose a time slot'); return; }
        if (useCustomTime && !customTime) { setError('Enter a custom time (HH:MM)'); return; }

        const medList = medicines.map(m => m.trim()).filter(Boolean);
        if (medList.length === 0) { setError('Add at least one medicine'); return; }
        if (!useDateMode && selectedDays.length === 0) { setError('Select at least one day'); return; }

        const tsInfo = TIME_SLOTS.find(t => t.key === selectedTimeSlot);
        const resolvedTime = useCustomTime ? customTime.trim() : (tsInfo?.time || '08:00');

        setLoading(true);
        try {
            const slotData = {
                timeSlot: useCustomTime ? 'custom' : selectedTimeSlot,
                scheduledTime: resolvedTime,
                medicines: medList,
                scheduledDate: useDateMode ? (scheduledDate || null) : null,
                dayOfWeek: useDateMode ? null : selectedDays,
                notes: notes.trim() || '',
                status: 'pending',
                dispense: false,    // only set true when patient requests dispensing
                reminded: false,
                addedBy: user.email,
                addedAt: new Date().toISOString(),
            };

            const newRef = push(ref(rtdb, `slots/${selectedPatient.id}`));
            await set(newRef, slotData);

            setSuccess(`✅ ${tsInfo?.label || 'Custom'} slot added`);
            setMedicines(['']);
            setNotes('');
            setSelectedDays(DAYS);
            setScheduledDate('');
            setCustomTime('');
            loadSlots();
        } catch (err) {
            setError('Failed to save: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteSlot(slotId) {
        Alert.alert('Delete Schedule', 'Remove this medicine schedule?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await remove(ref(rtdb, `slots/${selectedPatient.id}/${slotId}`));
                        setSuccess('Deleted');
                        loadSlots();
                    } catch (err) { setError('Failed to delete'); }
                }
            }
        ]);
    }

    if (!selectedPatient) {
        return (
            <View style={caregiverStyles.sectionCard}>
                <Text style={caregiverStyles.sectionTitle}>💊 Medicine Schedules</Text>
                <View style={caregiverStyles.emptyState}>
                    <Ionicons name="medical-outline" size={64} color="#343844" />
                    <Text style={caregiverStyles.emptyText}>Select a patient to manage</Text>
                </View>
            </View>
        );
    }

    // Group existing slots by timeSlot for display
    const grouped = {};
    slots.forEach(slot => {
        const key = slot.timeSlot || 'custom';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(slot);
    });

    return (
        <View style={caregiverStyles.sectionCard}>
            <Text style={caregiverStyles.sectionTitle}>
                💊 Schedules for {selectedPatient.email?.split('@')[0] || selectedPatient.name}
            </Text>

            {/* ── TIME SLOT PICKER ─────────────────────────────────────────── */}
            <Text style={smStyles.label}>Select Time Slot</Text>
            <View style={smStyles.timeSlotsRow}>
                {TIME_SLOTS.map(ts => {
                    const active = !useCustomTime && selectedTimeSlot === ts.key;
                    return (
                        <TouchableOpacity
                            key={ts.key}
                            onPress={() => { setSelectedTimeSlot(ts.key); setUseCustomTime(false); }}
                            style={[smStyles.timeSlotBtn, active && smStyles.timeSlotBtnActive]}
                            activeOpacity={0.8}
                        >
                            {active ? (
                                <LinearGradient colors={ts.colors} style={smStyles.timeSlotGradient}>
                                    <Text style={smStyles.timeSlotIcon}>{ts.icon}</Text>
                                    <Text style={[smStyles.timeSlotLabel, { color: '#fff' }]}>{ts.label}</Text>
                                    <Text style={[smStyles.timeSlotTime, { color: 'rgba(255,255,255,0.8)' }]}>{ts.time}</Text>
                                </LinearGradient>
                            ) : (
                                <View style={smStyles.timeSlotInner}>
                                    <Text style={smStyles.timeSlotIcon}>{ts.icon}</Text>
                                    <Text style={smStyles.timeSlotLabel}>{ts.label}</Text>
                                    <Text style={smStyles.timeSlotTime}>{ts.time}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Custom time toggle */}
            <View style={smStyles.toggleRow}>
                <Text style={smStyles.label}>Custom time instead</Text>
                <Switch
                    value={useCustomTime}
                    onValueChange={v => { setUseCustomTime(v); if (v) setSelectedTimeSlot(null); }}
                    trackColor={{ false: '#343844', true: '#4facfe' }}
                />
            </View>
            {useCustomTime && (
                <TextInput
                    style={caregiverStyles.input}
                    placeholder="e.g. 10:30"
                    placeholderTextColor="#7f8fa6"
                    value={customTime}
                    onChangeText={setCustomTime}
                    keyboardType="numbers-and-punctuation"
                />
            )}

            {/* ── MEDICINES ─────────────────────────────────────────────────── */}
            <Text style={smStyles.label}>Medicines for this slot</Text>
            {medicines.map((m, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <TextInput
                        style={[caregiverStyles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder={`e.g. Aspirin 75mg`}
                        placeholderTextColor="#7f8fa6"
                        value={m}
                        onChangeText={val => updateMedicine(idx, val)}
                    />
                    {medicines.length > 1 && (
                        <TouchableOpacity onPress={() => removeMedicineField(idx)} style={{ marginLeft: 8 }}>
                            <Ionicons name="remove-circle" size={24} color="#ff6b6b" />
                        </TouchableOpacity>
                    )}
                </View>
            ))}
            <TouchableOpacity onPress={addMedicineField} style={smStyles.addMedBtn}>
                <Ionicons name="add-circle-outline" size={18} color="#4facfe" />
                <Text style={smStyles.addMedText}>Add another medicine</Text>
            </TouchableOpacity>

            {/* ── SCHEDULE DAYS / DATE ──────────────────────────────────────── */}
            <View style={smStyles.toggleRow}>
                <Text style={smStyles.label}>One-time date only</Text>
                <Switch
                    value={useDateMode}
                    onValueChange={setUseDateMode}
                    trackColor={{ false: '#343844', true: '#4facfe' }}
                />
            </View>
            {useDateMode ? (
                <TextInput
                    style={caregiverStyles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#7f8fa6"
                    value={scheduledDate}
                    onChangeText={setScheduledDate}
                />
            ) : (
                <>
                    <Text style={smStyles.label}>Repeat on Days</Text>
                    <View style={smStyles.daysRow}>
                        {DAYS.map(d => (
                            <TouchableOpacity
                                key={d}
                                style={[smStyles.dayBtn, selectedDays.includes(d) && smStyles.dayBtnActive]}
                                onPress={() => toggleDay(d)}
                            >
                                <Text style={[smStyles.dayBtnText, selectedDays.includes(d) && smStyles.dayBtnTextActive]}>
                                    {DAY_LABELS[d]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            {/* ── NOTES + AUTO-DISPENSE ─────────────────────────────────────── */}
            <Text style={smStyles.label}>Notes (optional)</Text>
            <TextInput
                style={[caregiverStyles.input, { minHeight: 58, textAlignVertical: 'top' }]}
                placeholder="e.g. Take with food"
                placeholderTextColor="#7f8fa6"
                value={notes}
                onChangeText={setNotes}
                multiline
            />
            <View style={smStyles.toggleRow}>
                <Text style={smStyles.label}>Auto-Dispense on Schedule</Text>
                <Switch
                    value={dispense}
                    onValueChange={setDispense}
                    trackColor={{ false: '#343844', true: '#00b09b' }}
                />
            </View>

            {/* ── SAVE BUTTON ───────────────────────────────────────────────── */}
            <TouchableOpacity style={caregiverStyles.addButton} onPress={addSlot} disabled={loading}>
                <LinearGradient colors={['#4facfe', '#00f2fe']} style={caregiverStyles.addButtonGradient}>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={caregiverStyles.addButtonText}>
                        {loading ? 'Saving...' : 'Add Schedule'}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>

            {error ? (
                <View style={caregiverStyles.errorMessage}>
                    <Ionicons name="alert-circle-outline" size={18} color="#ff7979" />
                    <Text style={caregiverStyles.errorText}>{error}</Text>
                </View>
            ) : null}
            {success ? (
                <View style={caregiverStyles.successMessage}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#2ed573" />
                    <Text style={caregiverStyles.successText}>{success}</Text>
                </View>
            ) : null}

            {/* ── EXISTING SCHEDULES (grouped by time slot) ─────────────────── */}
            {slots.length === 0 ? (
                <View style={caregiverStyles.emptyState}>
                    <Ionicons name="calendar-outline" size={48} color="#343844" />
                    <Text style={caregiverStyles.emptyText}>No schedules added yet</Text>
                </View>
            ) : (
                <>
                    {/* Render in TIME_SLOTS order, then custom */}
                    {[...TIME_SLOTS.map(t => t.key), 'custom'].map(tsKey => {
                        const group = grouped[tsKey];
                        if (!group || group.length === 0) return null;
                        const tsInfo = TIME_SLOTS.find(t => t.key === tsKey);
                        return (
                            <View key={tsKey} style={{ marginTop: 18 }}>
                                {/* Group header */}
                                <LinearGradient
                                    colors={tsInfo?.colors || ['#888', '#777']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={smStyles.groupHeader}
                                >
                                    <Text style={smStyles.groupHeaderText}>
                                        {tsInfo?.icon || '⏰'} {tsInfo?.label || 'Custom'} · {group[0]?.scheduledTime}
                                    </Text>
                                </LinearGradient>

                                {group.map(slot => (
                                    <View key={slot.id} style={smStyles.slotCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                {/* Status badges */}
                                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                                    <View style={[smStyles.statusBadge, { backgroundColor: statusColor(slot.status) }]}>
                                                        <Text style={smStyles.statusText}>{(slot.status || 'pending').replace('_', ' ')}</Text>
                                                    </View>
                                                    {slot.dispense && (
                                                        <View style={[smStyles.statusBadge, { backgroundColor: '#00b09b' }]}>
                                                            <Text style={smStyles.statusText}>auto</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Medicine chips */}
                                                <View style={smStyles.chipsRow}>
                                                    {(slot.medicines || []).map((m, i) => (
                                                        <View key={i} style={smStyles.chip}>
                                                            <Text style={smStyles.chipText}>{m}</Text>
                                                        </View>
                                                    ))}
                                                </View>

                                                {/* Days */}
                                                {slot.dayOfWeek && (
                                                    <Text style={smStyles.meta}>
                                                        📅 {(Array.isArray(slot.dayOfWeek)
                                                            ? slot.dayOfWeek
                                                            : Object.values(slot.dayOfWeek)
                                                        ).map(d => DAY_LABELS[d] || d).join('  ')}
                                                    </Text>
                                                )}
                                                {slot.scheduledDate && <Text style={smStyles.meta}>📅 {slot.scheduledDate}</Text>}
                                                {slot.notes ? <Text style={smStyles.notesText}>📝 {slot.notes}</Text> : null}
                                            </View>

                                            <TouchableOpacity onPress={() => deleteSlot(slot.id)} style={caregiverStyles.removeButton}>
                                                <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </>
            )}
        </View>
n    );
}

function statusColor(status) {
    switch (status) {
        case 'dispensed': return '#38ef7d';
        case 'ready_to_dispense': return '#00b09b';
        case 'missed': return '#ee5253';
        default: return '#fda085';
    }
}

const smStyles = {
    label: { fontSize: 12, color: '#a0aab2', marginBottom: 8, marginTop: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Time slot grid
    timeSlotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
    timeSlotBtn: {
        flex: 1, minWidth: '44%', borderRadius: 18,
        borderWidth: 1.5, borderColor: '#343844',
        overflow: 'hidden',
    },
    timeSlotBtnActive: { borderColor: 'transparent' },
    timeSlotGradient: { padding: 14, alignItems: 'center', borderRadius: 18 },
    timeSlotInner: { padding: 14, alignItems: 'center', backgroundColor: '#22252e' },
    timeSlotIcon: { fontSize: 22, marginBottom: 4 },
    timeSlotLabel: { fontSize: 13, fontWeight: '800', color: '#a0aab2', marginBottom: 2 },
    timeSlotTime: { fontSize: 11, color: '#7f8fa6', fontWeight: '600' },

    // Days
    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    dayBtn: {
        width: 38, height: 38, borderRadius: 19,
        borderWidth: 1.5, borderColor: '#343844', backgroundColor: '#22252e',
        alignItems: 'center', justifyContent: 'center',
    },
    dayBtnActive: { borderColor: '#4facfe', backgroundColor: 'rgba(79, 172, 254, 0.15)' },
    dayBtnText: { fontSize: 11, fontWeight: '700', color: '#a0aab2' },
    dayBtnTextActive: { color: '#4facfe', fontWeight: '900' },

    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: 6 },

    addMedBtn: {
        flexDirection: 'row', alignItems: 'center',
        marginBottom: 14, marginTop: 4, paddingVertical: 10, paddingHorizontal: 14,
        backgroundColor: 'rgba(79, 172, 254, 0.12)', borderRadius: 14,
        alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(79, 172, 254, 0.3)'
    },
    addMedText: { color: '#4facfe', fontWeight: '800', fontSize: 14, marginLeft: 6 },

    // Group header
    groupHeader: {
        borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 8,
    },
    groupHeaderText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

    // Slot card
    slotCard: {
        backgroundColor: '#22252e', borderRadius: 18, padding: 16,
        marginBottom: 8, borderWidth: 1, borderColor: '#343844',
    },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: {
        backgroundColor: 'rgba(79, 172, 254, 0.15)', borderRadius: 14,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(79, 172, 254, 0.3)'
    },
    chipText: { color: '#4facfe', fontSize: 13, fontWeight: '800' },
    meta: { fontSize: 13, color: '#a0aab2', marginTop: 4, fontWeight: '500' },
    notesText: { fontSize: 13, color: '#00f2fe', marginTop: 6, fontStyle: 'italic' },
};
