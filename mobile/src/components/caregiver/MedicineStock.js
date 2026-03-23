import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { rtdb } from '../../config/firebase';
import { ref, onValue, push, set, remove, get, child } from 'firebase/database';
import { caregiverStyles } from './styles/caregiver.styles';

export default function MedicineStock({ user }) {
    const [stock, setStock] = useState([]);
    const [patients, setPatients] = useState({});      // { uid: { email, name } }
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // ── form state ──────────────────────────────────────────────────────────
    const [formName, setFormName] = useState('');
    const [formQty, setFormQty] = useState('');
    const [formUnit, setFormUnit] = useState('tablets');
    const [formReorder, setFormReorder] = useState('10');
    const [formExpiry, setFormExpiry] = useState('');
    const [formPatientId, setFormPatientId] = useState('');   // which patient this stock belongs to
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (!user?.uid) return;

        // Load caregiver's patient list first
        const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
        const unsubPatients = onValue(patientsRef, (pSnap) => {
            if (!pSnap.exists()) {
                setPatients({});
                setStock([]);
                setLoading(false);
                return;
            }
            const pData = pSnap.val();
            setPatients(pData);

            // Auto-select first patient in form picker
            const firstId = Object.keys(pData)[0];
            setFormPatientId(prev => prev || firstId);

            // Load stock for all patients
            const patientIds = Object.keys(pData);
            const allStock = [];
            let loaded = 0;

            patientIds.forEach(patientId => {
                const stockRef = ref(rtdb, `medicineStock/${patientId}`);
                onValue(stockRef, (snap) => {
                    if (snap.exists()) {
                        const data = snap.val();
                        Object.keys(data).forEach(key => {
                            allStock.push({
                                id: key,
                                patientId,
                                patientName: pData[patientId]?.name || pData[patientId]?.email?.split('@')[0] || 'Patient',
                                ...data[key]
                            });
                        });
                    }
                    loaded++;
                    if (loaded === patientIds.length) {
                        allStock.sort((a, b) => {
                            const aLow = a.quantity <= a.reorderLevel;
                            const bLow = b.quantity <= b.reorderLevel;
                            if (aLow && !bLow) return -1;
                            if (!aLow && bLow) return 1;
                            return (a.name || '').localeCompare(b.name || '');
                        });
                        setStock([...allStock]);
                        setLoading(false);
                    }
                }, () => {
                    loaded++;
                    if (loaded === patientIds.length) setLoading(false);
                });
            });
        }, () => setLoading(false));

        return () => unsubPatients();
    }, [user?.uid]);

    async function addStock() {
        setFormError('');
        if (!formName.trim()) { setFormError('Enter medicine name'); return; }
        if (!formQty || isNaN(parseInt(formQty))) { setFormError('Enter a valid quantity'); return; }
        if (!formPatientId) { setFormError('No patient linked'); return; }

        setSaving(true);
        try {
            const entry = {
                name: formName.trim(),
                quantity: parseInt(formQty, 10),
                unit: formUnit.trim() || 'tablets',
                reorderLevel: parseInt(formReorder, 10) || 10,
                expiryDate: formExpiry.trim() || null,
                addedBy: user.email,
                addedAt: new Date().toISOString(),
            };
            const newRef = push(ref(rtdb, `medicineStock/${formPatientId}`));
            await set(newRef, entry);

            // reset form
            setFormName('');
            setFormQty('');
            setFormUnit('tablets');
            setFormReorder('10');
            setFormExpiry('');
            setShowForm(false);
        } catch (err) {
            setFormError('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteStock(patientId, stockId) {
        Alert.alert('Remove Stock', 'Remove this stock entry?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    try {
                        await remove(ref(rtdb, `medicineStock/${patientId}/${stockId}`));
                    } catch (err) {
                        console.error('Failed to delete stock', err);
                    }
                }
            }
        ]);
    }

    const lowStockCount = stock.filter(s => s.quantity <= s.reorderLevel).length;
    const patientList = Object.entries(patients);

    return (
        <View style={caregiverStyles.sectionCard}>
            {/* ── Header row ───────────────────────────────────────────── */}
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => setCollapsed(!collapsed)}
                activeOpacity={0.7}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={caregiverStyles.sectionTitle}>📦 Medicine Stock</Text>
                    {lowStockCount > 0 && (
                        <View style={stockStyles.lowBadge}>
                            <Text style={stockStyles.lowBadgeText}>{lowStockCount} low</Text>
                        </View>
                    )}
                </View>
                <Ionicons
                    name={collapsed ? 'chevron-down' : 'chevron-up'}
                    size={20} color="#a0aab2"
                />
            </TouchableOpacity>

            {!collapsed && (
                <>
                    {/* ── Add Stock button / form ──────────────────────── */}
                    {showForm ? (
                        <View style={stockStyles.form}>
                            <Text style={stockStyles.formTitle}>Add Stock Entry</Text>

                            {formError ? (
                                <Text style={{ color: '#ff7979', marginBottom: 8, fontSize: 13 }}>{formError}</Text>
                            ) : null}

                            <Text style={stockStyles.label}>Medicine Name</Text>
                            <TextInput
                                style={caregiverStyles.input}
                                placeholder="e.g. Paracetamol 500mg"
                                placeholderTextColor="#7f8fa6"
                                value={formName}
                                onChangeText={setFormName}
                            />

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={stockStyles.label}>Quantity</Text>
                                    <TextInput
                                        style={[caregiverStyles.input, { marginBottom: 0 }]}
                                        placeholder="100"
                                        placeholderTextColor="#7f8fa6"
                                        value={formQty}
                                        onChangeText={setFormQty}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={stockStyles.label}>Unit</Text>
                                    <TextInput
                                        style={[caregiverStyles.input, { marginBottom: 0 }]}
                                        placeholder="tablets"
                                        placeholderTextColor="#7f8fa6"
                                        value={formUnit}
                                        onChangeText={setFormUnit}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={stockStyles.label}>Reorder at (qty)</Text>
                                    <TextInput
                                        style={[caregiverStyles.input, { marginBottom: 0 }]}
                                        placeholder="10"
                                        placeholderTextColor="#7f8fa6"
                                        value={formReorder}
                                        onChangeText={setFormReorder}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={stockStyles.label}>Expiry (YYYY-MM-DD)</Text>
                                    <TextInput
                                        style={[caregiverStyles.input, { marginBottom: 0 }]}
                                        placeholder="2027-01-01"
                                        placeholderTextColor="#7f8fa6"
                                        value={formExpiry}
                                        onChangeText={setFormExpiry}
                                    />
                                </View>
                            </View>

                            {/* Patient selector */}
                            {patientList.length > 1 && (
                                <>
                                    <Text style={[stockStyles.label, { marginTop: 12 }]}>Patient</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                                        {patientList.map(([pid, pinfo]) => (
                                            <TouchableOpacity
                                                key={pid}
                                                style={[stockStyles.patientChip, formPatientId === pid && stockStyles.patientChipActive]}
                                                onPress={() => setFormPatientId(pid)}
                                            >
                                                <Text style={[stockStyles.patientChipText, formPatientId === pid && { color: '#4facfe' }]}>
                                                    {pinfo.name || pinfo.email?.split('@')[0]}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Action buttons */}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                                <TouchableOpacity
                                    style={[caregiverStyles.addButton, { flex: 1 }]}
                                    onPress={addStock}
                                    disabled={saving}
                                >
                                    <LinearGradient colors={['#4facfe', '#00f2fe']} style={caregiverStyles.addButtonGradient}>
                                        <Text style={caregiverStyles.addButtonText}>{saving ? 'Saving...' : 'Save Stock'}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={stockStyles.cancelBtn}
                                    onPress={() => { setShowForm(false); setFormError(''); }}
                                >
                                    <Text style={stockStyles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={stockStyles.addStockBtn} onPress={() => setShowForm(true)}>
                            <Ionicons name="add-circle-outline" size={18} color="#4facfe" />
                            <Text style={stockStyles.addStockText}>Add Stock Entry</Text>
                        </TouchableOpacity>
                    )}

                    {/* ── Stock list ──────────────────────────────────── */}
                    {loading ? (
                        <ActivityIndicator color="#4facfe" style={{ marginVertical: 16 }} />
                    ) : stock.length === 0 ? (
                        <View style={caregiverStyles.emptyState}>
                            <Ionicons name="cube-outline" size={48} color="#343844" />
                            <Text style={caregiverStyles.emptyText}>No stock entries yet</Text>
                        </View>
                    ) : stock.map(item => {
                        const isLow = item.quantity <= item.reorderLevel;
                        return (
                            <View key={item.id} style={[stockStyles.row, isLow && stockStyles.rowLow]}>
                                <View style={stockStyles.rowLeft}>
                                    <Text style={stockStyles.name}>{item.name}</Text>
                                    <Text style={stockStyles.meta}>
                                        {item.patientName}
                                        {item.expiryDate ? ` · Exp: ${item.expiryDate}` : ''}
                                    </Text>
                                    {isLow && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="warning-outline" size={13} color="#ff7979" />
                                            <Text style={stockStyles.reorderText}> Reorder ≤ {item.reorderLevel}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={stockStyles.rowRight}>
                                    <LinearGradient
                                        colors={isLow ? ['#ff6b6b', '#ee5253'] : ['#00b09b', '#96c93d']}
                                        style={stockStyles.quantityBadge}
                                    >
                                        <Text style={stockStyles.quantityText}>
                                            {item.quantity} {item.unit || 'units'}
                                        </Text>
                                    </LinearGradient>
                                    <TouchableOpacity
                                        onPress={() => deleteStock(item.patientId, item.id)}
                                        style={{ marginTop: 8, alignSelf: 'flex-end' }}
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </>
            )}
        </View>
    );
}

const stockStyles = {
    addStockBtn: {
        flexDirection: 'row', alignItems: 'center',
        marginVertical: 14, paddingVertical: 10, paddingHorizontal: 14,
        backgroundColor: 'rgba(79, 172, 254, 0.12)', borderRadius: 14,
        alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(79, 172, 254, 0.3)'
    },
    addStockText: { color: '#4facfe', fontWeight: '800', fontSize: 14, marginLeft: 6 },
    form: {
        backgroundColor: '#1a1c23',
        borderRadius: 20,
        padding: 18,
        marginVertical: 14,
        borderWidth: 1,
        borderColor: '#343844',
    },
    formTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 14 },
    label: { fontSize: 12, color: '#a0aab2', marginBottom: 6, marginTop: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    cancelBtn: {
        borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18,
        backgroundColor: 'rgba(255,107,107,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtnText: { color: '#ff7979', fontWeight: '700', fontSize: 15 },
    patientChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
        backgroundColor: '#22252e', borderWidth: 1, borderColor: '#343844',
    },
    patientChipActive: { borderColor: '#4facfe', backgroundColor: 'rgba(79,172,254,0.15)' },
    patientChipText: { color: '#a0aab2', fontWeight: '700', fontSize: 13 },
    row: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 6,
        borderBottomWidth: 1, borderBottomColor: '#2a2d36',
    },
    rowLow: {
        backgroundColor: 'rgba(238, 82, 83, 0.08)',
        borderRadius: 12, paddingHorizontal: 10, marginVertical: 4, borderBottomWidth: 0,
    },
    rowLeft: { flex: 1, marginRight: 12 },
    rowRight: { alignItems: 'flex-end' },
    name: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
    meta: { fontSize: 13, color: '#a0aab2', marginTop: 4 },
    quantityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
    quantityText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
    reorderText: { fontSize: 12, color: '#ff7979', fontWeight: '600' },
    lowBadge: {
        backgroundColor: '#ee5253', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10,
    },
    lowBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
};
