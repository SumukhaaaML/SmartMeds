import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../../config/firebase';
import { ref, get, child, push, set, remove } from 'firebase/database';
import { caregiverStyles } from './styles/caregiver.styles';

export default function MedicineManager({ selectedPatient, user }) {
    const [medicines, setMedicines] = useState([]);
    const [medicineName, setMedicineName] = useState('');
    const [dosage, setDosage] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (selectedPatient) {
            loadMedicines();
        } else {
            setMedicines([]);
        }
    }, [selectedPatient]);

    async function loadMedicines() {
        try {
            const snapshot = await get(child(ref(rtdb), `medicines/${selectedPatient.id}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setMedicines(list);
            } else {
                setMedicines([]);
            }
        } catch (err) {
            console.error('Failed to load medicines', err);
        }
    }

    async function addMedicine() {
        setError('');
        setSuccess('');
        if (!selectedPatient) {
            setError('Select a patient first');
            return;
        }
        if (!medicineName.trim()) {
            setError('Enter medicine name');
            return;
        }

        setLoading(true);
        try {
            const medicineData = {
                name: medicineName.trim(),
                dosage: dosage.trim() || 'As prescribed',
                scheduledTime: scheduledTime || '',
                addedBy: user.email,
                addedAt: new Date().toISOString(),
                status: 'pending',
                time: 'morning',
                slot: 1
            };

            const newMedicineRef = push(ref(rtdb, `medicines/${selectedPatient.id}`));
            await set(newMedicineRef, medicineData);

            setSuccess(`${medicineName} added successfully!`);
            setMedicineName('');
            setDosage('');
            setScheduledTime('');
            loadMedicines();
        } catch (err) {
            setError('Failed to add medicine: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function deleteMedicine(medicineId) {
        Alert.alert(
            'Delete Medicine',
            'Are you sure you want to delete this medicine?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await remove(ref(rtdb, `medicines/${selectedPatient.id}/${medicineId}`));
                            setSuccess('Medicine deleted');
                            loadMedicines();
                        } catch (err) {
                            setError('Failed to delete medicine');
                        }
                    }
                }
            ]
        );
    }

    if (!selectedPatient) {
        return (
            <View style={caregiverStyles.sectionCard}>
                <Text style={caregiverStyles.sectionTitle}>💊 Medicines</Text>
                <View style={caregiverStyles.emptyState}>
                    <Ionicons name="medical-outline" size={64} color="#e0e0e0" />
                    <Text style={caregiverStyles.emptyText}>Select a patient to manage medicines</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={caregiverStyles.sectionCard}>
            <Text style={caregiverStyles.sectionTitle}>
                💊 Prescription for {selectedPatient.email.split('@')[0]}
            </Text>

            <View style={caregiverStyles.addPatientForm}>
                <TextInput
                    style={caregiverStyles.input}
                    placeholder="Medicine Name (e.g., Aspirin)"
                    value={medicineName}
                    onChangeText={setMedicineName}
                />
                <View style={caregiverStyles.inputRow}>
                    <TextInput
                        style={caregiverStyles.input}
                        placeholder="Dosage (e.g., 500mg)"
                        value={dosage}
                        onChangeText={setDosage}
                    />
                    <TextInput
                        style={caregiverStyles.input}
                        placeholder="Time (HH:MM)"
                        value={scheduledTime}
                        onChangeText={setScheduledTime}
                    />
                </View>
                <TouchableOpacity
                    style={caregiverStyles.addButton}
                    onPress={addMedicine}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={['#4facfe', '#00f2fe']}
                        style={caregiverStyles.addButtonGradient}
                    >
                        <Text style={caregiverStyles.addButtonText}>
                            {loading ? 'Adding...' : '+ Add Medicine'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {error ? (
                <View style={caregiverStyles.errorMessage}>
                    <Ionicons name="alert-circle" size={20} color="#c62828" />
                    <Text style={caregiverStyles.errorText}>{error}</Text>
                </View>
            ) : null}

            {success ? (
                <View style={caregiverStyles.successMessage}>
                    <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
                    <Text style={caregiverStyles.successText}>{success}</Text>
                </View>
            ) : null}

            {medicines.length === 0 ? (
                <View style={caregiverStyles.emptyState}>
                    <Ionicons name="file-tray-outline" size={48} color="#e0e0e0" />
                    <Text style={caregiverStyles.emptyText}>No medicines added yet</Text>
                </View>
            ) : (
                <FlatList
                    data={medicines}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={caregiverStyles.medicineItem}>
                            <View style={caregiverStyles.medicineInfo}>
                                <Text style={caregiverStyles.medicineName}>{item.name}</Text>
                                <Text style={caregiverStyles.medicineDetails}>
                                    {item.dosage} {item.scheduledTime ? `• ⏰ ${item.scheduledTime}` : ''}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={caregiverStyles.removeButton}
                                onPress={() => deleteMedicine(item.id)}
                            >
                                <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
