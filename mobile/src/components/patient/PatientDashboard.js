import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AudioRecorder from './AudioRecorder';
import MedicineDisplay from './MedicineDisplay';
import PatientAlerts from './PatientAlerts';
import { patientStyles } from './styles/patient.styles';

export default function PatientDashboard({ user, onLogout }) {
    const [detectedMedicine, setDetectedMedicine] = useState(null);

    const handleDetection = (medicineData) => {
        setDetectedMedicine(medicineData);
    };

    return (
        <View style={patientStyles.mainContainer}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={patientStyles.headerBg}
            >
                <View style={patientStyles.headerContent}>
                    <View>
                        <Text style={patientStyles.greeting}>Welcome back,</Text>
                        <Text style={patientStyles.userEmail}>{user?.email?.split('@')[0] || 'Patient'}</Text>
                    </View>
                    <TouchableOpacity style={patientStyles.signOutBtn} onPress={onLogout}>
                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={patientStyles.dashboardContent}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                <PatientAlerts user={user} />
                <AudioRecorder user={user} onDetection={handleDetection} />
                <MedicineDisplay
                    detectedMedicine={detectedMedicine}
                    user={user}
                />
            </ScrollView>
        </View>
    );
}
