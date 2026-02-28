import { useState } from 'react';

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
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
            osc.start(ctx.currentTime + 0.15);
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'error') {
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

export default function MedicineDisplay({
    detectedMedicine,
    medicines,
    onDispense,
    setError,
    setSuccess,
    user  // Add user prop
}) {
    const [apiKey, setApiKey] = useState('');
    const [processing, setProcessing] = useState(false);

    const sendInstruction = async () => {
        if (!detectedMedicine?.medicine_name) return;

        // Show confirmation alert
        const dosageText = detectedMedicine.dosage ? ` (${detectedMedicine.dosage})` : '';
        const confirmed = window.confirm(`Dispense ${detectedMedicine.medicine_name}${dosageText}?\n\nThis will update the status for Raspberry Pi to dispense.`);
        if (!confirmed) {
            setError('Dispense cancelled');
            return;
        }

        setProcessing(true);
        try {
            setError('');
            setSuccess('');
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const response = await fetch(`${BACKEND}/send_instruction`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    medicine_name: detectedMedicine.medicine_name,
                    patient_uid: user.uid,  // Include patient UID for database update
                    dosage: detectedMedicine.dosage,
                    action: 'dispense'
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Send instruction failed');
            }
            playConfirmationSound('success');
            setSuccess(`${detectedMedicine.medicine_name} ready to dispense from slot ${data.slot}`);

            // Notify parent to add reminder
            if (onDispense) {
                onDispense(detectedMedicine.medicine_name, detectedMedicine.dosage);
            }
        } catch (err) {
            setError('Failed to send instruction: ' + err.message);
            playConfirmationSound('error');
        } finally {
            setProcessing(false);
        }
    };

    const dispenseIndividual = async (medicineName, medicineDosage) => {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(`${BACKEND}/send_instruction`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                medicine_name: medicineName,
                patient_uid: user.uid,  // Include patient UID
                dosage: medicineDosage,
                action: 'dispense'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Send instruction failed');
        }
        playConfirmationSound('success');
        if (onDispense) {
            onDispense(medicineName, medicineDosage);
        }
    };

    return (
        <div>
            {/* Batch Medicines Display */}
            {detectedMedicine?.batch && (
                <div className="batch-medicine-section">
                    <h3>Today's Medicines ({detectedMedicine.count})</h3>
                    <ul className="batch-medicines-list">
                        {detectedMedicine.medicines.map((med, index) => (
                            <li key={index} className="batch-medicine-item">
                                <strong>{med.name}</strong>
                                <span>{med.dosage}</span>
                                <span className="scheduled-time">{med.scheduledTime}</span>
                            </li>
                        ))}
                    </ul>
                    <button
                        className="dispense-btn batch"
                        onClick={async () => {
                            // Dispense all medicines in sequence
                            setProcessing(true);
                            setError('');
                            setSuccess('');
                            try {
                                for (const med of detectedMedicine.medicines) {
                                    await dispenseIndividual(med.name, med.dosage);
                                }
                                setSuccess(`All ${detectedMedicine.count} medicines dispensed successfully`);
                            } catch (err) {
                                setError('Failed to dispense all medicines: ' + err.message);
                                playConfirmationSound('error');
                            } finally {
                                setProcessing(false);
                            }
                        }}
                        disabled={processing}
                    >
                        Dispense All {detectedMedicine.count} Medicines
                    </button>
                </div>
            )}

            {/* Single Medicine Display */}
            {detectedMedicine && !detectedMedicine.batch && (
                <div className="detected-section">
                    <div className="result-label">Detected Medicine</div>
                    <div className="result-value medicine-badge">
                        {detectedMedicine.medicine_name}
                        {detectedMedicine.dosage && (
                            <span className="dosage-badge">{detectedMedicine.dosage}</span>
                        )}
                    </div>

                    <button
                        className="dispense-btn"
                        onClick={sendInstruction}
                        disabled={processing}
                    >
                        Dispense {detectedMedicine.medicine_name}
                    </button>
                </div>
            )}

            <input
                type="text"
                placeholder="API Key (optional)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="api-key-input"
            />

            {/* Medicine List */}
            <div className="medicine-list-section">
                <div className="result-label">Available Medicines</div>
                <div className="medicine-list">
                    {medicines.length === 0 ? (
                        <div className="no-medicines">No medicines available</div>
                    ) : (
                        medicines.map((med, idx) => (
                            <span key={idx} className="medicine-tag">
                                {med.name || med}
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
