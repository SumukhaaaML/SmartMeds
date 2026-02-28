import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../config/constants';
import { patientStyles } from './styles/patient.styles';
import { sendLocalNotification } from '../../services/NotificationService';

export default function AudioRecorder({ user, onDetection }) {
    const recordingRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');

    // Cleanup recording on component unmount
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(e => {
                    console.log('Error cleaning up recording on unmount:', e);
                });
            }
        };
    }, []);

    async function startRecording() {
        try {
            // Clean up any existing recording object first
            if (recordingRef.current) {
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch (e) {
                    console.log('Error cleaning up previous recording:', e);
                }
                recordingRef.current = null;
            }

            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission required', 'Microphone permission is required to record.');
                return;
            }
            const rec = new Audio.Recording();
            await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
            await rec.startAsync();
            recordingRef.current = rec;
            setIsRecording(true);
            setTranscript('');
        } catch (err) {
            console.error('startRecording error', err);
            Alert.alert('Recording failed', String(err));
        }
    }

    async function stopRecording() {
        try {
            if (!recordingRef.current) return;
            setIsRecording(false);
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            await processAndUpload(uri);
        } catch (err) {
            console.error('stopRecording error', err);
            Alert.alert('Stop recording failed', String(err));
        }
    }

    async function processAndUpload(uri) {
        setProcessing(true);
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) throw new Error('Recorded file not found');

            const filename = uri.split('/').pop();
            const type = 'audio/m4a';
            const formData = new FormData();
            formData.append('audio', { uri, name: filename, type });

            const endpoint = user?.uid
                ? `${API_ENDPOINTS.PROCESS_AUDIO}?patient_uid=${user.uid}`
                : API_ENDPOINTS.PROCESS_AUDIO;

            const resp = await fetch(endpoint, { method: 'POST', body: formData });
            const text = await resp.text();
            let data = {};
            try { data = JSON.parse(text); } catch (e) { data = { error: text }; }

            if (resp.ok) {
                setTranscript(data.text || '');

                // Handle time-based batch command
                if (data.batch_command && data.time_category) {
                    const timeCategory = data.time_category;
                    try {
                        const dispenseResp = await fetch(API_ENDPOINTS.DISPENSE_BY_TIME, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                time: timeCategory,
                                patient_uid: user.uid
                            })
                        });
                        const dispenseData = await dispenseResp.json();

                        if (dispenseResp.ok) {
                            const count = dispenseData.count || 0;
                            const medicines = dispenseData.medicines || [];
                            if (count > 0) {
                                const medNames = medicines.map(m => m.name).join(', ');
                                Alert.alert(
                                    'Batch Dispensing',
                                    `Dispensing ${count} ${timeCategory} medicine(s): ${medNames}`
                                );
                                // Send notification
                                await sendLocalNotification(
                                    'Medicines Dispensed',
                                    `${count} ${timeCategory} medicine(s) dispensed: ${medNames}`
                                );
                                onDetection({
                                    batch_command: true,
                                    time_category: timeCategory,
                                    count,
                                    medicines
                                });
                            } else {
                                Alert.alert('No Medicines', `No ${timeCategory} medicines with auto-dispense enabled`);
                                onDetection({ medicine_name: null, message: `No ${timeCategory} medicines found` });
                            }
                        } else {
                            Alert.alert('Batch Dispense Failed', dispenseData.error || 'Unknown error');
                        }
                    } catch (err) {
                        console.error('Batch dispense error', err);
                        Alert.alert('Connection Error', 'Could not dispense medicines');
                    }
                } else if (data.medicine_name) {
                    onDetection(data);
                } else {
                    onDetection({ medicine_name: null, message: 'No matching medicine' });
                }
            } else {
                Alert.alert('Processing failed', data.error || JSON.stringify(data));
            }
        } catch (err) {
            console.error('processAndUpload error', err);
            Alert.alert('Upload failed', `Could not connect to backend.\nCheck your network or IP configuration.`);
        } finally {
            setProcessing(false);
        }
    }

    return (
        <View style={patientStyles.statusCard}>
            <Text style={patientStyles.cardTitle}>Current Session</Text>

            <View style={patientStyles.transcriptBox}>
                <Text style={patientStyles.transcriptLabel}>TRANSCRIPT</Text>
                <Text style={patientStyles.transcriptText}>{transcript || 'Waiting for audio...'}</Text>
            </View>

            <View style={[patientStyles.recordSection, { marginTop: 20 }]}>
                <TouchableOpacity
                    style={[patientStyles.recordBtn, isRecording && patientStyles.recordingActive]}
                    onPress={isRecording ? stopRecording : startRecording}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={isRecording ? ['#ff6b6b', '#ee5253'] : ['#4834d4', '#686de0']}
                        style={patientStyles.recordBtnGradient}
                    >
                        <Ionicons name={isRecording ? "stop" : "mic"} size={40} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
                <Text style={patientStyles.recordInstruction}>
                    {isRecording ? 'Listening... Tap to stop' : 'Tap to start recording'}
                </Text>
                {processing && <ActivityIndicator style={{ marginTop: 10 }} color="#4834d4" />}
            </View>
        </View>
    );
}
