import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../config/constants';
import { patientStyles } from './styles/patient.styles';
import { sendLocalNotification } from '../../services/NotificationService';

export default function AudioRecorder({ user, onDetection }) {
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const [isRecording, setIsRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');

    async function startRecording() {
        try {
            const { granted } = await AudioModule.requestRecordingPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission required', 'Microphone permission is required to record.');
                return;
            }
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setIsRecording(true);
            setTranscript('');
        } catch (err) {
            console.error('startRecording error', err);
            Alert.alert('Recording failed', String(err));
        }
    }

    async function stopRecording() {
        try {
            if (!audioRecorder.isRecording) return;
            setIsRecording(false);
            await audioRecorder.stop();
            const uri = audioRecorder.uri;
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
                const transcriptText = data.text || '';
                setTranscript(transcriptText);

                // ── BRANCH 1: time-based batch ("dispense morning medicines") ──
                if (data.batch_command && data.time_category) {
                    await handleBatchDispense(data.time_category);

                // ── BRANCH 2: specific medicine name detected ──────────────────
                } else if (data.medicine_name) {
                    onDetection(data);

                // ── BRANCH 3: generic "dispense" with no target ────────────────
                // e.g. "dispense", "give me my medicine", "dispense now"
                } else {
                    const lower = transcriptText.toLowerCase();
                    const isGenericDispense =
                        lower.includes('dispense') ||
                        lower.includes('give me') ||
                        lower.includes('medicine') ||
                        lower.includes('medikation') ||
                        data.batch_command; // batch_command but no time category

                    if (isGenericDispense) {
                        // Dispense ALL of today's pending slots
                        await handleBatchDispense(null);
                    } else {
                        onDetection({ medicine_name: null, message: 'No matching medicine' });
                    }
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

    /**
     * Call /dispense_by_time — if timeCategory is null/undefined, dispenses ALL today's slots.
     */
    async function handleBatchDispense(timeCategory) {
        try {
            const body = { patient_uid: user.uid };
            if (timeCategory) body.time = timeCategory;

            const dispenseResp = await fetch(API_ENDPOINTS.DISPENSE_BY_TIME, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const dispenseData = await dispenseResp.json();

            if (dispenseResp.ok) {
                const count = dispenseData.count || 0;
                const medicines = dispenseData.medicines || [];

                if (count > 0) {
                    const medNames = medicines
                        .flatMap(m => m.medicines || [m.name])
                        .filter(Boolean)
                        .join(', ');

                    const label = timeCategory
                        ? `${timeCategory} medicines`
                        : 'all today\'s medicines';

                    Alert.alert(
                        '✅ Dispensing',
                        `Dispensing ${count} slot(s) — ${medNames}`
                    );
                    await sendLocalNotification(
                        'Medicines Dispensed',
                        `${count} slot(s) dispensed: ${medNames}`
                    );
                    onDetection({
                        batch_command: true,
                        time_category: timeCategory || 'all',
                        auto_dispensed: true,
                        dispensed_count: count,
                        medicines
                    });
                } else {
                    const label = timeCategory || 'today';
                    Alert.alert('No Medicines', `No pending ${label} medicines with auto-dispense enabled`);
                    onDetection({ medicine_name: null, message: `No pending medicines found` });
                }
            } else {
                Alert.alert('Dispense Failed', dispenseData.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Batch dispense error', err);
            Alert.alert('Connection Error', 'Could not dispense medicines');
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
