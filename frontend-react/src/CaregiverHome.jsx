import { useState, useEffect } from 'react';
import { rtdb } from './firebase';
import { ref, onValue, remove, set, push } from 'firebase/database';
import './caregiver.css';
import Alerts from './Alerts';

export default function CaregiverHome({ user, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientMedicines, setPatientMedicines] = useState([]);
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [newMedicineName, setNewMedicineName] = useState('');
  const [newMedicineDosage, setNewMedicineDosage] = useState('');
  const [newMedicineTime, setNewMedicineTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load caregiver's patients
  useEffect(() => {
    const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
    const unsubscribe = onValue(patientsRef, (snapshot) => {
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
    });
    return unsubscribe;
  }, [user.uid]);

  // Load selected patient's medicines
  useEffect(() => {
    if (!selectedPatient) {
      setPatientMedicines([]);
      return;
    }

    // Use Realtime Database instead of Firestore
    const medicinesRef = ref(rtdb, `medicines/${selectedPatient.id}`);
    const unsubscribe = onValue(medicinesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const meds = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setPatientMedicines(meds);
      } else {
        setPatientMedicines([]);
      }
    });

    return () => unsubscribe();
  }, [selectedPatient]);

  const addPatient = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPatientEmail.trim()) {
      setError('Enter patient email');
      return;
    }

    setLoading(true);
    try {
      // Find patient by email in Realtime Database
      const usersRef = ref(rtdb, 'users');
      let patientId = null;

      onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
          const users = snapshot.val();
          for (const uid in users) {
            if (users[uid].email === newPatientEmail && users[uid].userType === 'patient') {
              patientId = uid;
              break;
            }
          }
        }
      }, { onlyOnce: true });

      if (!patientId) {
        setError('Patient not found');
        setLoading(false);
        return;
      }

      // Get patient info
      const patientRef = ref(rtdb, `users/${patientId}`);
      let patientInfo = null;
      onValue(patientRef, (snapshot) => {
        if (snapshot.exists()) {
          patientInfo = snapshot.val();
        }
      }, { onlyOnce: true });

      // Add patient to caregiver's list
      await set(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`), {
        ...patientInfo,
        id: patientId,
        addedAt: new Date().toISOString()
      });

      setSuccess(`Patient ${patientInfo.name} added successfully`);
      setNewPatientEmail('');
    } catch (err) {
      setError('Failed to add patient: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePatient = async (patientId) => {
    if (!window.confirm('Remove this patient?')) return;
    try {
      await remove(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`));
      if (selectedPatient?.id === patientId) {
        setSelectedPatient(null);
        setPatientMedicines([]);
      }
      setSuccess('Patient removed');
    } catch (err) {
      setError('Failed to remove patient: ' + err.message);
    }
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

    setLoading(true);
    try {
      // Find the next available medicine number (1-8)
      const usedNumbers = patientMedicines
        .map(med => med.medicineNumber || med.slot)
        .filter(num => num !== null && num !== undefined);

      let nextNumber = 1;
      for (let i = 1; i <= 8; i++) {
        if (!usedNumbers.includes(i)) {
          nextNumber = i;
          break;
        }
      }

      // Use Realtime Database push to add medicine
      const medicinesRef = ref(rtdb, `medicines/${selectedPatient.id}`);
      const newMedicineRef = push(medicinesRef);

      await set(newMedicineRef, {
        name: newMedicineName.trim(),
        dosage: newMedicineDosage.trim() || 'As prescribed',
        scheduledTime: newMedicineTime || '',
        addedBy: user.email,
        addedAt: new Date().toISOString(),
        slot: nextNumber,
        medicineNumber: nextNumber,  // Add medicine number
        time: newMedicineTime ? getTimeCategory(newMedicineTime) : '',  // Auto-detect time category
        dispense: true  // Enable for batch dispensing
      });

      setSuccess(`${newMedicineName} added as Medicine #${nextNumber} for ${selectedPatient.name}`);
      setNewMedicineName('');
      setNewMedicineDosage('');
      setNewMedicineTime('');

      // Medicine list will auto-update via onValue listener
    } catch (err) {
      setError('Failed to add medicine: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine time category from scheduled time
  const getTimeCategory = (time) => {
    if (!time) return '';
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const deleteMedicine = async (medicineId) => {
    if (!selectedPatient || !window.confirm('Delete this medicine?')) return;
    try {
      await remove(ref(rtdb, `medicines/${selectedPatient.id}/${medicineId}`));
      setSuccess('Medicine removed');
      // Medicine list will auto-update via onValue listener
    } catch (err) {
      setError('Failed to delete medicine: ' + err.message);
    }
  };

  return (
    <div className="caregiver-container">
      <header className="caregiver-header">
        <div>
          <h1>Caregiver Dashboard</h1>
        </div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>

      <div className="caregiver-content">
        {/* Add Patient Section */}
        <section className="add-patient-section">
          <h2>Add Patient</h2>
          <form onSubmit={addPatient}>
            <div className="form-group">
              <input
                type="email"
                placeholder="Patient Email"
                value={newPatientEmail}
                onChange={(e) => setNewPatientEmail(e.target.value)}
                className="form-input"
              />
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Adding...' : 'Add Patient'}
              </button>
            </div>
          </form>
        </section>

        {/* Messages */}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <Alerts user={user} />

        <div className="caregiver-body">
          {/* Patients List */}
          <section className="patients-section">
            <h2>Your Patients</h2>
            {patients.length === 0 ? (
              <p className="no-data">No patients added yet</p>
            ) : (
              <ul className="patients-list">
                {patients.map(patient => (
                  <li
                    key={patient.id}
                    className={`patient-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className="patient-info">
                      <strong>{patient.name}</strong>
                      <small>{patient.email}</small>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePatient(patient.id);
                      }}
                      className="btn-remove"
                      title="Remove patient"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Patient Medicines */}
          <section className="medicines-section">
            <h2>Medicines for {selectedPatient?.name || 'Selected Patient'}</h2>

            {selectedPatient ? (
              <>

                <form onSubmit={addMedicine} className="add-medicine-form">
                  <input
                    type="text"
                    placeholder="Medicine Name"
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Dosage (e.g., 500mg)"
                    value={newMedicineDosage}
                    onChange={(e) => setNewMedicineDosage(e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="time"
                    value={newMedicineTime}
                    onChange={(e) => setNewMedicineTime(e.target.value)}
                    className="form-input"
                  />
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Adding...' : 'Add Medicine'}
                  </button>
                </form>

                {/* Medicines List */}
                {patientMedicines.length === 0 ? (
                  <p className="no-data">No medicines added yet</p>
                ) : (
                  <ul className="medicines-list">
                    {patientMedicines.map(medicine => (
                      <li key={medicine.id} className="medicine-item">
                        <div className="medicine-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {(medicine.medicineNumber || medicine.slot) && (
                              <span style={{
                                background: '#667eea',
                                color: 'white',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                #{medicine.medicineNumber || medicine.slot}
                              </span>
                            )}
                            <strong>{medicine.name}</strong>
                          </div>
                          <small>{medicine.dosage || 'As prescribed'}</small>
                          {medicine.scheduledTime && <small className="med-time">{medicine.scheduledTime} ({medicine.time || 'scheduled'})</small>}
                        </div>
                        <button
                          onClick={() => deleteMedicine(medicine.id)}
                          className="btn-remove"
                          title="Delete medicine"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="no-data">Select a patient to manage medicines</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
