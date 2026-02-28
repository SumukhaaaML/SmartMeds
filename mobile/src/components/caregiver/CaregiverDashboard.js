import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PatientList from './PatientList';
import MedicineManager from './MedicineManager';
import Alerts from './Alerts';
import { caregiverStyles } from './styles/caregiver.styles';

export default function CaregiverDashboard({ user, onLogout }) {
    const [selectedPatient, setSelectedPatient] = useState(null);

    return (
        <View style={caregiverStyles.mainContainer}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={['#1a2980', '#26d0ce']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={caregiverStyles.headerBg}
            >
                <View style={caregiverStyles.headerContent}>
                    <View>
                        <Text style={caregiverStyles.headerTitle}>Caregiver Panel</Text>
                        <Text style={caregiverStyles.headerSubtitle}>Logged in as {user?.email?.split('@')[0] || 'Caregiver'}</Text>
                    </View>
                    <TouchableOpacity style={caregiverStyles.signOutBtn} onPress={onLogout}>
                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={caregiverStyles.dashboardContent}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                <Alerts user={user} />
                <PatientList
                    user={user}
                    onSelectPatient={setSelectedPatient}
                    selectedPatient={selectedPatient}
                />
                <MedicineManager
                    selectedPatient={selectedPatient}
                    user={user}
                />
            </ScrollView>
        </View>
    );
}
