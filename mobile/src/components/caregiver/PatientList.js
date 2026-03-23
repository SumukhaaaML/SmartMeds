import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rtdb } from '../../config/firebase';
import { ref, get, child, set, remove } from 'firebase/database';
import { LinearGradient } from 'expo-linear-gradient';
import { caregiverStyles } from './styles/caregiver.styles';

export default function PatientList({ user, onSelectPatient, selectedPatient }) {
    const [patients, setPatients] = useState([]);
    const [newPatientEmail, setNewPatientEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadPatients();
    }, [user.uid]);

    async function loadPatients() {
        try {
            const snapshot = await get(child(ref(rtdb), `caregivers/${user.uid}/patients`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const patientList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setPatients(patientList);
            } else {
                setPatients([]);
            }
        } catch (err) {
            console.error('Failed to load patients', err);
        }
    }

    async function addPatient() {
        setError('');
        setSuccess('');
        if (!newPatientEmail.trim()) {
            setError('Enter patient email');
            return;
        }

        setLoading(true);
        try {
            // Find patient by email
            const usersSnapshot = await get(child(ref(rtdb), 'users'));
            if (!usersSnapshot.exists()) {
                setError('No users found');
                return;
            }

            const users = usersSnapshot.val();
            let patientId = null;
            let patientInfo = null;

            for (const uid in users) {
                if (users[uid].email?.toLowerCase() === newPatientEmail.trim().toLowerCase() && users[uid].userType === 'patient') {
                    patientId = uid;
                    patientInfo = users[uid];
                    break;
                }
            }

            if (!patientId) {
                setError('Patient not found');
                setLoading(false);
                return;
            }

            // Check if patient already added
            const existingPatient = patients.find(p => p.id === patientId);
            if (existingPatient) {
                setError('Patient already added');
                setLoading(false);
                return;
            }

            // Add patient to caregiver's list
            await set(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`), {
                email: patientInfo.email,
                name: patientInfo.name || 'Patient',
                addedAt: new Date().toISOString()
            });

            setSuccess(`Patient added successfully!`);
            setNewPatientEmail('');
            loadPatients();
        } catch (err) {
            setError('Failed to add patient: ' + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function removePatient(patientId) {
        Alert.alert(
            'Remove Patient',
            'Are you sure you want to remove this patient?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await remove(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`));
                            if (selectedPatient?.id === patientId) {
                                onSelectPatient(null);
                            }
                            loadPatients();
                            setSuccess('Patient removed');
                        } catch (err) {
                            setError('Failed to remove patient');
                        }
                    }
                }
            ]
        );
    }

    return (
        <View style={caregiverStyles.sectionCard}>
            <Text style={caregiverStyles.sectionTitle}>👥 Your Patients</Text>

            <View style={caregiverStyles.addPatientForm}>
                <View style={caregiverStyles.inputRow}>
                    <TextInput
                        style={caregiverStyles.input}
                        placeholder="Patient Email"
                        placeholderTextColor="#7f8fa6"
                        value={newPatientEmail}
                        onChangeText={setNewPatientEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        style={[caregiverStyles.addButton, { marginTop: 0, alignSelf: 'center' }]}
                        onPress={addPatient}
                        disabled={loading}
                    >
                        <LinearGradient colors={['#4facfe', '#00f2fe']} style={caregiverStyles.addButtonGradient}>
                            <Text style={caregiverStyles.addButtonText}>
                                {loading ? 'Adding...' : 'Add'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {error ? (
                <View style={caregiverStyles.errorMessage}>
                    <Text style={caregiverStyles.errorText}>{error}</Text>
                </View>
            ) : null}

            {success ? (
                <View style={caregiverStyles.successMessage}>
                    <Text style={caregiverStyles.successText}>{success}</Text>
                </View>
            ) : null}

            {patients.length === 0 ? (
                <View style={caregiverStyles.emptyState}>
                    <Ionicons name="people-outline" size={48} color="#ccc" />
                    <Text style={caregiverStyles.emptyText}>No patients added yet</Text>
                </View>
            ) : (
                <View>
                    {patients.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                caregiverStyles.patientItem,
                                selectedPatient?.id === item.id && caregiverStyles.patientItemActive
                            ]}
                            onPress={() => onSelectPatient(item)}
                        >
                            <View style={caregiverStyles.patientInfo}>
                                <Text style={caregiverStyles.patientName}>
                                    {item.name || item.email.split('@')[0]}
                                </Text>
                                <Text style={caregiverStyles.patientEmail}>
                                    {item.email} · Added {new Date(item.addedAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={caregiverStyles.removeButton}
                                onPress={() => removePatient(item.id)}
                            >
                                <Ionicons name="close" size={20} color="#ff6b6b" />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
