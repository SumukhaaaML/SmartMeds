import { useState, useEffect } from 'react';

export default function Reminders({ setSuccess }) {
    const [reminders, setReminders] = useState([]);
    const [showReminders, setShowReminders] = useState(false);

    // Load reminders on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('smartmeds_reminders') || '[]';
            setReminders(JSON.parse(stored));
        } catch (e) {
            console.warn('Failed to load reminders', e);
        }
    }, []);

    const addReminder = (medicineName, medicineDosage, intervalHours = 8) => {
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

        setSuccess(`✅ Reminder set for ${medicineName} every ${intervalHours} hours`);
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

    // Expose addReminder to parent via ref or callback
    useEffect(() => {
        window.addMedicineReminder = addReminder;
        return () => {
            delete window.addMedicineReminder;
        };
    }, [reminders]);

    return (
        <div>
            <button
                className="reminders-toggle-btn"
                onClick={() => setShowReminders(!showReminders)}
                style={{ marginTop: '1.5rem' }}
            >
                🔔 {reminders.length > 0 ? `Reminders (${reminders.length})` : 'No Reminders'}
            </button>

            {showReminders && (
                <div className="reminders-container">
                    <div className="reminders-title">Active Reminders</div>
                    {reminders.length === 0 ? (
                        <p className="no-reminders">No active reminders. Dispense a medicine to set one.</p>
                    ) : (
                        reminders.map((reminder) => (
                            <div key={reminder.id} className="reminder-item">
                                <span className="reminder-text">
                                    💊 {reminder.medicineName}{reminder.medicineDosage ? ` (${reminder.medicineDosage})` : ''} — Every {reminder.intervalHours} hours
                                </span>
                                <button
                                    onClick={() => removeReminder(reminder.id)}
                                    className="reminder-remove-btn"
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

