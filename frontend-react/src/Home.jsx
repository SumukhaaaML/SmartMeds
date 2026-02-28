import { useState, useRef, useEffect } from 'react';
import './app.css';

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

export default function Home({ user, onLogout, medicines }) {
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detected, setDetected] = useState('');
  const [dosage, setDosage] = useState('');
  const [lastDetected, setLastDetected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [reminders, setReminders] = useState([]);
  const [showReminders, setShowReminders] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      setError('');
      setTranscript('');
      setDetected('');
      setDosage('');
      setLastDetected(null);

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
      if (data.medicine_name) {
        setDetected(data.medicine_name);
        setDosage(data.dosage || '');
        setLastDetected(data);
        playConfirmationSound('success');
        setSuccess(`Detected: ${data.medicine_name}${data.dosage ? ` (${data.dosage})` : ''}`);
      } else {
        setDetected('No matching medicine');
        playConfirmationSound('error');
      }
    } catch (err) {
      setError('Upload failed: ' + err.message);
      playConfirmationSound('error');
    } finally {
      setProcessing(false);
    }
  };

  const sendInstruction = async () => {
    if (!lastDetected?.medicine_name) return;

    // Show confirmation alert
    const dosageText = lastDetected.dosage ? ` (${lastDetected.dosage})` : '';
    const confirmed = window.confirm(`Dispense ${lastDetected.medicine_name}${dosageText}?\n\nThis will send the instruction to the Raspberry Pi.`);
    if (!confirmed) {
      setError('Dispense cancelled');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(`${BACKEND}/send_instruction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          medicine_name: lastDetected.medicine_name,
          dosage: lastDetected.dosage,
          action: 'dispense'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Send instruction failed');
      }
      playConfirmationSound('success');
      setSuccess(`${lastDetected.medicine_name} dispensed successfully`);

      // Auto add reminder for this medicine
      const intervalHours = 8;
      addReminder(lastDetected.medicine_name, lastDetected.dosage, intervalHours);
    } catch (err) {
      setError('Failed to send instruction: ' + err.message);
      playConfirmationSound('error');
    }
  };

  const addReminder = (medicineName, medicineDosage, intervalHours) => {
    const newReminder = {
      id: `${medicineName}_${Date.now()}`,
      medicineName,
      medicineDosage,
      intervalHours,
      nextDueTime: Date.now() + intervalHours * 3600000,
      createdAt: Date.now()
    };
    setReminders([...reminders, newReminder]);

    // Also save to localStorage for persistence
    try {
      const stored = localStorage.getItem('smartmeds_reminders') || '[]';
      const list = JSON.parse(stored);
      list.push(newReminder);
      localStorage.setItem('smartmeds_reminders', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save reminder', e);
    }

    setSuccess(`Reminder set for ${medicineName} every ${intervalHours} hours`);
  };

  const removeReminder = (id) => {
    setReminders(reminders.filter(r => r.id !== id));
    try {
      const stored = localStorage.getItem('smartmeds_reminders') || '[]';
      const list = JSON.parse(stored).filter(r => r.id !== id);
      localStorage.setItem('smartmeds_reminders', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to remove reminder', e);
    }
  };

  // Load reminders on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smartmeds_reminders') || '[]';
      setReminders(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load reminders', e);
    }
  }, []);

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>SmartMeds</h1>
        <div className="user-info">{user?.email}</div>
        <button className="sign-out-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>

      <div className="app-content">
        <div className="app-card">
          <button
            className="record-btn"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={processing}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>

          {processing && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span className="loading-spinner">⟳</span> Processing...
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="result-section">
            <div className="result-label">Transcript</div>
            <div className="result-value">{transcript || '—'}</div>
          </div>

          <div className="result-section">
            <div className="result-label">Detected Medicine</div>
            <div className="result-value">{detected || '—'}</div>
          </div>

          <div className="result-section">
            <div className="result-label">Dosage</div>
            <div className="result-value">{dosage || '—'}</div>
          </div>

          <input
            type="text"
            placeholder="API Key (optional)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="api-key-input"
          />

          <button
            className="dispense-btn"
            onClick={sendInstruction}
            disabled={!lastDetected?.medicine_name || processing}
          >
            Send Instruction
          </button>

          {medicines && medicines.length > 0 && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your Medicines:</div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                💡 Say the medicine name or number (e.g., "Medicine 3" or "Paracetamol")
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {medicines.map((med, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.6rem',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0'
                  }}>
                    {(med.medicineNumber || med.slot) && (
                      <span style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        minWidth: '24px',
                        textAlign: 'center'
                      }}>
                        #{med.medicineNumber || med.slot}
                      </span>
                    )}
                    <span style={{ fontSize: '0.85rem', color: '#333' }}>
                      {typeof med === 'string' ? med : med.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="reminders-toggle-btn"
            onClick={() => setShowReminders(!showReminders)}
            style={{ marginTop: '1.5rem' }}
          >
            {reminders.length > 0 ? `Reminders (${reminders.length})` : 'No Reminders'}
          </button>

          {showReminders && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #667eea' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Active Reminders:</div>
              {reminders.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: '#999' }}>No active reminders. Dispense a medicine to set one.</p>
              ) : (
                reminders.map((reminder) => (
                  <div key={reminder.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', padding: '0.5rem', background: '#fff', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {reminder.medicineName}{reminder.medicineDosage ? ` (${reminder.medicineDosage})` : ''} — Every {reminder.intervalHours} hours
                    </span>
                    <button
                      onClick={() => removeReminder(reminder.id)}
                      style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
