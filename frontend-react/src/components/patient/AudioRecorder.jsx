import { useState, useRef } from 'react';

const BACKEND = 'http://127.0.0.1:5000';

// Audio confirmation helper
function playConfirmationSound(type = 'success') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            // Two ascending beeps
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
            osc.start(ctx.currentTime + 0.15);
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'error') {
            // Low beep
            osc.frequency.value = 300;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        console.warn('Could not play confirmation sound', e);
    }
}

export default function AudioRecorder({ user, onDetection, setError, setSuccess }) {
    const [isRecording, setIsRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        try {
            setError('');
            setTranscript('');

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await uploadAudio(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            setError('Microphone access denied: ' + err.message);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const uploadAudio = async (blob) => {
        setProcessing(true);
        setError('');
        setSuccess('');
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.webm');

            // Pass patient UID to backend so it can load patient-specific medicines
            const response = await fetch(`${BACKEND}/process_audio?patient_uid=${user.uid}`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            setTranscript(data.text || '');

            // Check if it's a batch command
            if (data.batch_command) {
                // Fetch today's medicines
                const todaysResponse = await fetch(`${BACKEND}/get_todays_medicines?patient_uid=${user.uid}`);
                if (todaysResponse.ok) {
                    const todaysData = await todaysResponse.json();
                    if (todaysData.medicines && todaysData.medicines.length > 0) {
                        onDetection({
                            batch: true,
                            medicines: todaysData.medicines,
                            count: todaysData.count
                        });
                        playConfirmationSound('success');
                        setSuccess(`✅ Found ${todaysData.count} medicine(s) for today`);
                    } else {
                        onDetection(null);
                        playConfirmationSound('error');
                        setError('No medicines scheduled for today');
                    }
                } else {
                    throw new Error('Failed to fetch today\'s medicines');
                }
            } else if (data.medicine_name) {
                onDetection(data);
                playConfirmationSound('success');
                setSuccess(`✅ Detected: ${data.medicine_name}${data.dosage ? ` (${data.dosage})` : ''}`);
            } else {
                onDetection(null);
                playConfirmationSound('error');
            }
        } catch (err) {
            setError('Upload failed: ' + err.message);
            playConfirmationSound('error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div>
            <button
                className="record-btn"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={processing}
            >
                {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
            </button>

            {processing && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <span className="loading-spinner">⟳</span> Processing...
                </div>
            )}

            <div className="result-section">
                <div className="result-label">Transcript</div>
                <div className="result-value">{transcript || '—'}</div>
            </div>
        </div>
    );
}
