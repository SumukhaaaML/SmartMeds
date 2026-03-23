/**
 * NotificationScheduler.js
 * Schedules local push notifications for each medicine slot.
 * Call refreshSchedule(slots, user) whenever the slot list changes.
 * The scheduler clears old notifications and reschedules based on current slots.
 */
import * as Notifications from 'expo-notifications';

const TIME_LABELS = {
    morning:   '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening:   '🌆 Evening',
    night:     '🌙 Night',
    custom:    '⏰',
};

/**
 * Parse "HH:MM" into { hours, minutes }.
 */
function parseTime(timeStr) {
    const [h, m] = (timeStr || '').split(':').map(Number);
    return { hours: isNaN(h) ? 8 : h, minutes: isNaN(m) ? 0 : m };
}

/**
 * Return the next Date object when this slot should fire.
 * For dayOfWeek slots: schedules for the next matching day at the slot's time.
 * For scheduledDate slots: schedules for that exact date at the slot's time.
 */
function nextFireDate(slot) {
    const now = new Date();
    const { hours, minutes } = parseTime(slot.scheduledTime);

    if (slot.scheduledDate) {
        // One-time date slot
        const d = new Date(slot.scheduledDate);
        d.setHours(hours, minutes, 0, 0);
        return d > now ? d : null;   // null if the date has passed
    }

    // Recurring: find next matching day of week
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const allowedDays = Array.isArray(slot.dayOfWeek)
        ? slot.dayOfWeek.map(d => d.toLowerCase())
        : Object.values(slot.dayOfWeek || {}).map(d => d.toLowerCase());

    for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setDate(now.getDate() + offset);
        candidate.setHours(hours, minutes, 0, 0);
        const dayName = days[candidate.getDay()];
        if (allowedDays.includes(dayName) && candidate > now) {
            return candidate;
        }
    }
    return null;
}

/**
 * Cancel all previously scheduled medicine reminders.
 */
export async function cancelAllMedicineReminders() {
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const medicineIds = scheduled
            .filter(n => n.content.data?.type === 'medicine_reminder')
            .map(n => n.identifier);
        await Promise.all(medicineIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));
        console.log(`[NotificationScheduler] Cancelled ${medicineIds.length} reminders`);
    } catch (err) {
        console.warn('[NotificationScheduler] cancelAll error:', err);
    }
}

/**
 * Schedule a reminder notification for a single slot.
 * Returns the notification identifier or null if not scheduled.
 */
async function scheduleSlotReminder(slot) {
    // Don't schedule already-dispensed slots
    if (slot.status === 'dispensed') return null;

    const fireDate = nextFireDate(slot);
    if (!fireDate) return null;

    const label = TIME_LABELS[slot.timeSlot] || '⏰';
    const medList = (slot.medicines || []).join(', ') || 'your medicines';

    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: `💊 Time for ${label} medicines`,
                body: `Please take: ${medList}`,
                sound: true,
                data: {
                    type: 'medicine_reminder',
                    slotId: slot.id,
                    timeSlot: slot.timeSlot,
                    scheduledTime: slot.scheduledTime,
                },
            },
            trigger: fireDate,
        });
        return id;
    } catch (err) {
        console.warn('[NotificationScheduler] schedule error:', err);
        return null;
    }
}

/**
 * Main entry point.
 * Call this when patient logs in or whenever slots change.
 * Clears old reminders and schedules fresh ones for all pending slots.
 */
export async function refreshMedicineSchedule(slots) {
    await cancelAllMedicineReminders();

    const pendingSlots = (slots || []).filter(s => s.status !== 'dispensed');
    let scheduled = 0;

    for (const slot of pendingSlots) {
        const id = await scheduleSlotReminder(slot);
        if (id) scheduled++;
    }

    console.log(`[NotificationScheduler] Scheduled ${scheduled} medicine reminders`);
    return scheduled;
}
