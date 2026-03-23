import { useState, useEffect } from 'react';
import { rtdb } from './firebase';
import { ref, onValue, remove, set, push } from 'firebase/database';
import './caregiver.css';
import Alerts from './Alerts';

// Helper
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function todayAbbrev() {
  return ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
}
function slotIsToday(slot) {
  if (slot.scheduledDate) return slot.scheduledDate === todayStr();
  if (slot.dayOfWeek) {
    const days = Array.isArray(slot.dayOfWeek) ? slot.dayOfWeek : Object.values(slot.dayOfWeek);
    return days.map(d => d.toLowerCase()).includes(todayAbbrev());
  }
  return true;
}

export default function CaregiverHome({ user, onLogout }) {
  const [patients, setPatients]               = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSlots, setPatientSlots]       = useState([]);
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');

  // ── new slot form ──────────────────────────────────────────────────────────
  const [slotNumber, setSlotNumber]       = useState('1');
  const [medicines, setMedicines]         = useState(['']);
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [useDateMode, setUseDateMode]     = useState(false);
  const [selectedDays, setSelectedDays]   = useState([...DAYS]);
  const [notes, setNotes]                 = useState('');
  const [dispense, setDispense]           = useState(true);

  // ── load patients ──────────────────────────────────────────────────────────
  useEffect(() => {
    const patientsRef = ref(rtdb, `caregivers/${user.uid}/patients`);
    const unsub = onValue(patientsRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setPatients(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setPatients([]);
      }
    });
    return unsub;
  }, [user.uid]);

  // ── load patient slots ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPatient) { setPatientSlots([]); return; }
    const slotsRef = ref(rtdb, `slots/${selectedPatient.id}`);
    const unsub = onValue(slotsRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data)
          .map(k => ({ id: k, ...data[k] }))
          .sort((a,b) => (a.slotNumber||0)-(b.slotNumber||0));
        setPatientSlots(list);
      } else {
        setPatientSlots([]);
      }
    });
    return unsub;
  }, [selectedPatient]);

  // ── add patient ────────────────────────────────────────────────────────────
  const addPatient = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!newPatientEmail.trim()) { setError('Enter patient email'); return; }
    setLoading(true);
    try {
      const usersRef = ref(rtdb, 'users');
      let patientId = null, patientInfo = null;
      onValue(usersRef, snap => {
        if (snap.exists()) {
          const users = snap.val();
          for (const uid in users) {
            if (users[uid].email === newPatientEmail && users[uid].userType === 'patient') {
              patientId = uid; patientInfo = users[uid]; break;
            }
          }
        }
      }, { onlyOnce: true });

      if (!patientId) { setError('Patient not found'); setLoading(false); return; }
      await set(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`), {
        email: patientInfo.email,
        name: patientInfo.name || 'Patient',
        addedAt: new Date().toISOString()
      });
      setSuccess(`Patient added`);
      setNewPatientEmail('');
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePatient = async (patientId) => {
    if (!window.confirm('Remove this patient?')) return;
    try {
      await remove(ref(rtdb, `caregivers/${user.uid}/patients/${patientId}`));
      if (selectedPatient?.id === patientId) { setSelectedPatient(null); }
      setSuccess('Patient removed');
    } catch (err) {
      setError('Failed: ' + err.message);
    }
  };

  // ── add slot ───────────────────────────────────────────────────────────────
  const addSlot = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedPatient) { setError('Select a patient first'); return; }
    const medList = medicines.map(m => m.trim()).filter(Boolean);
    if (!medList.length) { setError('Add at least one medicine'); return; }
    if (!scheduledTime) { setError('Enter scheduled time'); return; }

    setLoading(true);
    try {
      const slotData = {
        slotNumber:    parseInt(slotNumber, 10) || 1,
        medicines:     medList,
        scheduledTime: scheduledTime,
        scheduledDate: useDateMode ? (scheduledDate || null) : null,
        dayOfWeek:     useDateMode ? null : [...selectedDays],
        notes:         notes.trim() || '',
        status:        'pending',
        dispense:      dispense,
        reminded:      false,
        completedAt:   null,
        missedAt:      null,
        addedBy:       user.email,
        addedAt:       new Date().toISOString(),
      };
      const newRef = push(ref(rtdb, `slots/${selectedPatient.id}`));
      await set(newRef, slotData);
      setSuccess(`Slot ${slotNumber} added for ${selectedPatient.name}`);
      setMedicines(['']); setScheduledTime(''); setScheduledDate('');
      setSelectedDays([...DAYS]); setNotes(''); setDispense(true);
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSlot = async (slotId) => {
    if (!window.confirm('Delete this slot?')) return;
    try {
      await remove(ref(rtdb, `slots/${selectedPatient.id}/${slotId}`));
      setSuccess('Slot deleted');
    } catch (err) {
      setError('Failed: ' + err.message);
    }
  };

  const toggleDay = (d) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const updateMed = (idx, val) => {
    const u = [...medicines]; u[idx] = val; setMedicines(u);
  };

  const statusColor = s => ({
    dispensed: '#2ecc71', ready_to_dispense: '#00b09b', missed: '#e74c3c'
  }[s] || '#f39c12');

  return (
    <div className="caregiver-container">
      <header className="caregiver-header">
        <h1>Caregiver Dashboard</h1>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </header>

      <div className="caregiver-content">
        {/* Add Patient */}
        <section className="add-patient-section">
          <h2>Add Patient</h2>
          <form onSubmit={addPatient}>
            <div className="form-group">
              <input type="email" placeholder="Patient Email" value={newPatientEmail}
                onChange={e => setNewPatientEmail(e.target.value)} className="form-input" />
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Adding...' : 'Add Patient'}
              </button>
            </div>
          </form>
        </section>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <Alerts user={user} />

        <div className="caregiver-body">
          {/* Patient list */}
          <section className="patients-section">
            <h2>Your Patients</h2>
            {patients.length === 0 ? (
              <p className="no-data">No patients added yet</p>
            ) : (
              <ul className="patients-list">
                {patients.map(patient => (
                  <li key={patient.id}
                    className={`patient-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className="patient-info">
                      <strong>{patient.name}</strong>
                      <small>{patient.email}</small>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removePatient(patient.id); }}
                      className="btn-remove" title="Remove">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Slot manager */}
          <section className="medicines-section">
            <h2>Dispensing Slots  —  {selectedPatient?.name || 'Select a patient'}</h2>

            {selectedPatient ? (
              <>
                {/* ── ADD SLOT FORM ─────────────────────────────────── */}
                <form onSubmit={addSlot} className="add-medicine-form" style={{ gap: '0.6rem', display: 'flex', flexDirection: 'column' }}>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Slot #</label>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <button key={n} type="button"
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          border: `2px solid ${slotNumber == n ? '#667eea' : '#ddd'}`,
                          background: slotNumber == n ? '#667eea' : '#f5f5f5',
                          color: slotNumber == n ? '#fff' : '#555',
                          cursor: 'pointer', fontWeight: 700,
                        }}
                        onClick={() => setSlotNumber(String(n))}
                      >{n}</button>
                    ))}
                  </div>

                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Medicines in this slot</label>
                  {medicines.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.4rem' }}>
                      <input className="form-input" style={{ flex: 1 }}
                        placeholder={`Medicine ${idx+1} (e.g. Aspirin 75mg)`}
                        value={m} onChange={e => updateMed(idx, e.target.value)} />
                      {medicines.length > 1 && (
                        <button type="button" onClick={() => setMedicines(medicines.filter((_,i) => i!==idx))}
                          style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setMedicines([...medicines, ''])}
                    style={{ background:'none', border:'none', color:'#667eea', cursor:'pointer', textAlign:'left', fontWeight:600, fontSize:'0.85rem' }}>
                    + Add another medicine
                  </button>

                  <input className="form-input" type="time" value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    placeholder="Scheduled time" required />

                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <label style={{ fontSize:'0.85rem', fontWeight:600 }}>One-time date</label>
                    <input type="checkbox" checked={useDateMode} onChange={e => setUseDateMode(e.target.checked)} />
                  </div>

                  {useDateMode ? (
                    <input className="form-input" type="date" value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)} />
                  ) : (
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {DAYS.map(d => (
                        <button key={d} type="button"
                          style={{
                            padding:'4px 10px', borderRadius: 16, border:`2px solid ${selectedDays.includes(d) ? '#667eea' : '#ddd'}`,
                            background: selectedDays.includes(d) ? '#667eea' : '#f5f5f5',
                            color: selectedDays.includes(d) ? '#fff' : '#555',
                            cursor:'pointer', fontWeight:600, fontSize:'0.8rem',
                          }}
                          onClick={() => toggleDay(d)}
                        >{DAY_LABELS[d]}</button>
                      ))}
                    </div>
                  )}

                  <textarea className="form-input" rows={2} placeholder="Notes (e.g. Take with food)"
                    value={notes} onChange={e => setNotes(e.target.value)}
                    style={{ resize:'vertical', fontFamily:'inherit' }} />

                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <label style={{ fontSize:'0.85rem', fontWeight:600 }}>Auto-Dispense</label>
                    <input type="checkbox" checked={dispense} onChange={e => setDispense(e.target.checked)} />
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Saving...' : '+ Add Slot'}
                  </button>
                </form>

                {/* ── SLOT LIST ─────────────────────────────────────── */}
                <h3 style={{ marginTop:'1.5rem', marginBottom:'0.5rem', fontSize:'1rem', color:'#555' }}>
                  All Slots  ({patientSlots.length})
                </h3>
                {patientSlots.length === 0 ? (
                  <p className="no-data">No slots added yet</p>
                ) : (
                  <ul className="medicines-list">
                    {patientSlots.map(slot => (
                      <li key={slot.id} className="medicine-item" style={{ flexDirection:'column', alignItems:'stretch' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.3rem' }}>
                              <span style={{
                                background:'#667eea', color:'#fff',
                                padding:'0.2rem 0.6rem', borderRadius:12,
                                fontSize:'0.75rem', fontWeight:'bold'
                              }}>Slot {slot.slotNumber}</span>
                              <span style={{ fontSize:'0.9rem', fontWeight:600 }}>⏰ {slot.scheduledTime}</span>
                              <span style={{
                                background: statusColor(slot.status),
                                color:'#fff', padding:'0.15rem 0.5rem',
                                borderRadius:10, fontSize:'0.7rem', fontWeight:'bold'
                              }}>{(slot.status||'pending').replace('_',' ')}</span>
                              {slot.dispense && (
                                <span style={{ background:'#00b09b', color:'#fff', padding:'0.15rem 0.5rem', borderRadius:10, fontSize:'0.7rem', fontWeight:'bold' }}>
                                  Auto
                                </span>
                              )}
                            </div>

                            {/* Medicine chips */}
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.3rem' }}>
                              {(slot.medicines||[]).map((m,i) => (
                                <span key={i} style={{
                                  background:'#edf2fb', color:'#4834d4',
                                  padding:'0.2rem 0.6rem', borderRadius:12, fontSize:'0.8rem', fontWeight:600
                                }}>{m}</span>
                              ))}
                            </div>

                            {/* Days / date */}
                            {slot.dayOfWeek && (
                              <small style={{ color:'#888' }}>
                                📅 {(Array.isArray(slot.dayOfWeek)?slot.dayOfWeek:Object.values(slot.dayOfWeek)).join(', ')}
                              </small>
                            )}
                            {slot.scheduledDate && (
                              <small style={{ color:'#888' }}>📅 {slot.scheduledDate}</small>
                            )}

                            {/* Notes */}
                            {slot.notes && (
                              <p style={{ margin:'0.3rem 0 0', fontSize:'0.82rem', color:'#6c5ce7', fontStyle:'italic' }}>
                                📝 {slot.notes}
                              </p>
                            )}

                            {/* Timestamps */}
                            {slot.completedAt && (
                              <small style={{ color:'#2ecc71' }}>✅ Completed: {new Date(slot.completedAt).toLocaleString()}</small>
                            )}
                            {slot.missedAt && (
                              <small style={{ color:'#e74c3c' }}>❌ Missed: {new Date(slot.missedAt).toLocaleString()}</small>
                            )}
                          </div>

                          <button onClick={() => deleteSlot(slot.id)} className="btn-remove" title="Delete slot">✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="no-data">Select a patient to manage slots</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
