import { useState, useEffect } from 'react';
import { rtdb } from '../../config/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';

export default function MedicineManager({ selectedPatient, user }) {
    const [patientMedicines, setPatientMedicines] = useState([]);
    const [newMedicineName, setNewMedicineName] = useState('');
    const [newMedicineDosage, setNewMedicineDosage] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('1');
    const [selectedTime, setSelectedTime] = useState('morning');
    const [autoDispense, setAutoDispense] = useState(false);
    const [medicineStatus, setMedicineStatus] = useState('pending');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load selected patient's medicines from RTDB
    useEffect(() => {
        if (!selectedPatient) {
            setPatientMedicines([]);
            return;
        }

        const slotsRef = ref(rtdb, `slots/${selectedPatient.id}`);
        const unsubscribe = onValue(slotsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const meds = Object.keys(data).map(key => ({
                    id: key,
                    slot: data[key].slotNumber,
                    name: Array.isArray(data[key].medicines) ? data[key].medicines.join(', ') : '',
                    time: data[key].dayOfWeek ? (Array.isArray(data[key].dayOfWeek) ? data[key].dayOfWeek.join(',') : '') : '',
                    dispense: data[key].dispense,
                    status: data[key].status,
                    dosage: data[key].notes || '',
                    addedBy: data[key].addedBy,
                    scheduledTime: data[key].scheduledTime,
                    notes: data[key].notes || '',
                }));
                setPatientMedicines(meds);
            } else {
                setPatientMedicines([]);
            }
        });

        return unsubscribe;
    }, [selectedPatient]);

    // Check if slot is available
    const isSlotAvailable = (slotNumber) => {
        return !patientMedicines.some(med => med.slot === parseInt(slotNumber));
    };

    const addMedicine = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!selectedPatient) {
            setError('Select a patient first');
            return;
        }
        if (!newMedicineName.trim()) {
            setError('Enter medicine name');
            return;
        }

        // Validate slot availability
        if (!isSlotAvailable(selectedSlot)) {
            setError(`Slot ${selectedSlot} is already occupied. Please choose a different slot.`);
            return;
        }

        setLoading(true);
        try {
            const slotsRef2 = ref(rtdb, `slots/${selectedPatient.id}`);
            const newSlotRef = push(slotsRef2);

            await set(newSlotRef, {
                slotNumber: parseInt(selectedSlot),
                medicines: [newMedicineName.trim()],
                dayOfWeek: ['mon','tue','wed','thu','fri','sat','sun'],
                scheduledTime: selectedTime === 'morning' ? '08:00'
                             : selectedTime === 'afternoon' ? '13:00'
                             : selectedTime === 'evening' ? '18:00' : '21:00',
                dispense: autoDispense,
                status: medicineStatus,
                notes: newMedicineDosage.trim() || '',
                reminded: false,
                completedAt: null,
                missedAt: null,
                addedBy: user.email,
                addedAt: new Date().toISOString()
            });

            setSuccess(`✅ ${newMedicineName} added to slot ${selectedSlot} for ${selectedPatient.name}`);
            setNewMedicineName('');
            setNewMedicineDosage('');
            setSelectedSlot('1');
            setSelectedTime('morning');
            setAutoDispense(false);
            setMedicineStatus('pending');
        } catch (err) {
            setError('Failed to add medicine: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteMedicine = async (medicineId) => {
        if (!selectedPatient || !window.confirm('Delete this medicine?')) return;
        try {
            await remove(ref(rtdb, `slots/${selectedPatient.id}/${medicineId}`));
            setSuccess('✅ Medicine removed');
        } catch (err) {
            setError('Failed to delete medicine: ' + err.message);
        }
    };

    // Get time badge info
    const getTimeBadgeInfo = (time) => {
        const info = {
            morning: { icon: '☀️', label: 'Morning', color: '#ff9500' },
            afternoon: { icon: '🌤️', label: 'Afternoon', color: '#ffcc00' },
            evening: { icon: '🌆', label: 'Evening', color: '#9b59b6' },
            night: { icon: '🌙', label: 'Night', color: '#34495e' }
        };
        return info[time] || info.morning;
    };

    // Get status badge info
    const getStatusBadgeInfo = (status) => {
        const info = {
            pending: { icon: '⏳', label: 'Pending', color: '#95a5a6' },
            dispensed: { icon: '✅', label: 'Dispensed', color: '#27ae60' },
            skipped: { icon: '⏭️', label: 'Skipped', color: '#3498db' },
            completed: { icon: '🏁', label: 'Completed', color: '#7f8c8d' }
        };
        return info[status] || info.pending;
    };

    return (
        <div className="medicines-section">
            <h2>💊 Medicines for {selectedPatient?.name || 'Selected Patient'}</h2>

            {selectedPatient ? (
                <>
                    {error && <div className="alert alert-error">{error}</div>}
                    {success && <div className="alert alert-success">{success}</div>}

                    <form onSubmit={addMedicine} className="add-medicine-form">
                        <input
                            type="text"
                            placeholder="Medicine Name *"
                            value={newMedicineName}
                            onChange={(e) => setNewMedicineName(e.target.value)}
                            className="form-input"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Dosage (e.g., 500mg)"
                            value={newMedicineDosage}
                            onChange={(e) => setNewMedicineDosage(e.target.value)}
                            className="form-input"
                        />

                        <div className="form-row">
                            <select
                                value={selectedSlot}
                                onChange={(e) => setSelectedSlot(e.target.value)}
                                className="form-input"
                                required
                            >
                                <option value="">Select Slot *</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slot => (
                                    <option
                                        key={slot}
                                        value={slot}
                                        disabled={!isSlotAvailable(slot)}
                                    >
                                        Slot {slot} {!isSlotAvailable(slot) ? '(Occupied)' : ''}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                className="form-input"
                                required
                            >
                                <option value="morning">☀️ Morning</option>
                                <option value="afternoon">🌤️ Afternoon</option>
                                <option value="evening">🌆 Evening</option>
                                <option value="night">🌙 Night</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <select
                                value={medicineStatus}
                                onChange={(e) => setMedicineStatus(e.target.value)}
                                className="form-input"
                            >
                                <option value="pending">⏳ Pending</option>
                                <option value="dispensed">✅ Dispensed</option>
                                <option value="skipped">⏭️ Skipped</option>
                                <option value="completed">🏁 Completed</option>
                            </select>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={autoDispense}
                                    onChange={(e) => setAutoDispense(e.target.checked)}
                                    className="form-checkbox"
                                />
                                <span>Auto-Dispense</span>
                            </label>
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Adding...' : 'Add Medicine'}
                        </button>
                    </form>

                    {/* Medicines List */}
                    {patientMedicines.length === 0 ? (
                        <p className="no-data">No medicines added yet</p>
                    ) : (
                        <ul className="medicines-list">
                            {patientMedicines.map(medicine => {
                                const timeBadge = getTimeBadgeInfo(medicine.time);
                                const statusBadge = getStatusBadgeInfo(medicine.status);

                                return (
                                    <li key={medicine.id} className="medicine-item-enhanced">
                                        <div className="medicine-header-enhanced">
                                            <strong className="medicine-name">{medicine.name}</strong>
                                            <div className="medicine-badges">
                                                <span
                                                    className="slot-badge"
                                                    title={`Slot ${medicine.slot}`}
                                                >
                                                    📍 {medicine.slot}
                                                </span>
                                                <span
                                                    className="time-badge"
                                                    style={{ background: timeBadge.color }}
                                                    title={timeBadge.label}
                                                >
                                                    {timeBadge.icon} {timeBadge.label}
                                                </span>
                                                <span
                                                    className="status-badge"
                                                    style={{ background: statusBadge.color }}
                                                    title={statusBadge.label}
                                                >
                                                    {statusBadge.icon} {statusBadge.label}
                                                </span>
                                                {medicine.dispense && (
                                                    <span className="dispense-badge" title="Auto-dispense enabled">
                                                        🤖 Auto
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="medicine-details-enhanced">
                                            {medicine.dosage && <small>💊 {medicine.dosage}</small>}
                                            <small className="added-by">Added by {medicine.addedBy}</small>
                                        </div>
                                        <button
                                            onClick={() => deleteMedicine(medicine.id)}
                                            className="btn-remove"
                                            title="Delete medicine"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            ) : (
                <p className="no-data">Select a patient to manage medicines</p>
            )}
        </div>
    );
}
