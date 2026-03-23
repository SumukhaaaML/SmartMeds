"""
Background scheduler – checks slot schedules in slots/{uid} (new schema).
"""
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from firebase_admin import db
from reminder_utils import (
    is_medication_missed,
    get_caregiver_for_patient,
    create_patient_alert,
    create_caregiver_alert,
    has_existing_missed_alert,
    mark_slot_as_missed,
)
from notification_service import (
    notify_medicine_due,
    notify_medicine_missed,
    notify_caregiver_patient_missed,
)

scheduler = BackgroundScheduler()
GRACE_PERIOD_MINUTES = 30


# ──── helpers ────────────────────────────────────────────────────────────────

def _day_abbrev():
    return datetime.now().strftime('%a').lower()

def _today_str():
    return datetime.now().strftime('%Y-%m-%d')

def _slot_is_today(slot_data):
    dow = slot_data.get('dayOfWeek')
    sdate = slot_data.get('scheduledDate')
    today = _today_str()
    abbrev = _day_abbrev()
    if sdate:
        return sdate == today
    if dow:
        days = dow if isinstance(dow, list) else list(dow.values())
        return abbrev in [d.lower() for d in days]
    return True  # no restriction → every day


# ──── jobs ───────────────────────────────────────────────────────────────────

def check_medications():
    """Trigger due-alerts for slots whose scheduledTime matches now (HH:MM)."""
    print(f"[{datetime.now()}] Checking due slots...")
    try:
        all_slots = db.reference('slots').get()
        if not all_slots:
            return
        current_time = datetime.now().strftime("%H:%M")

        for patient_uid, slots in all_slots.items():
            if not slots:
                continue
            for slot_id, slot_data in slots.items():
                if not _slot_is_today(slot_data):
                    continue
                if slot_data.get('scheduledTime') == current_time:
                    if slot_data.get('status') not in ('dispensed', 'ready_to_dispense'):
                        _send_due_alert(patient_uid, slot_id, slot_data)
    except Exception as e:
        print(f"WARNING: Error in slot due check: {e}")


def check_missed_medications():
    """Mark slots as missed after grace period; alert patient and caregiver."""
    print(f"[{datetime.now()}] Checking for missed slots...")
    try:
        all_slots = db.reference('slots').get()
        if not all_slots:
            return

        for patient_uid, slots in all_slots.items():
            if not slots:
                continue
            for slot_id, slot_data in slots.items():
                if not _slot_is_today(slot_data):
                    continue
                scheduled_time = slot_data.get('scheduledTime')
                if not scheduled_time:
                    continue
                if not is_medication_missed(scheduled_time, GRACE_PERIOD_MINUTES):
                    continue

                status = slot_data.get('status', '')
                if status in ('dispensed', 'missed', 'ready_to_dispense'):
                    continue

                # Use first medicine name for alert labelling
                meds = slot_data.get('medicines', [])
                med_label = ', '.join(meds) if meds else 'Unknown'

                if has_existing_missed_alert(patient_uid, med_label, scheduled_time):
                    continue

                # Mark missed in DB
                mark_slot_as_missed(patient_uid, slot_id)

                # Build a medicine_data-like dict for existing notification helpers
                medicine_data = {
                    'name': med_label,
                    'scheduledTime': scheduled_time,
                    'notes': slot_data.get('notes', ''),
                    'slotNumber': slot_data.get('slotNumber'),
                }

                create_patient_alert(patient_uid, medicine_data, 'medication_missed')
                notify_medicine_missed(patient_uid, medicine_data)

                patient_ref = db.reference(f'users/{patient_uid}')
                patient_data = patient_ref.get()
                patient_name = patient_data.get('name') or patient_data.get('email', patient_uid) if patient_data else patient_uid

                caregiver_uid = get_caregiver_for_patient(patient_uid)
                if caregiver_uid:
                    create_caregiver_alert(caregiver_uid, patient_uid, patient_name, medicine_data)
                    notify_caregiver_patient_missed(caregiver_uid, patient_name, medicine_data)
                    print(f"Notified caregiver {caregiver_uid} about patient {patient_uid} missing slot {slot_id}")

    except Exception as e:
        print(f"WARNING: Error in missed slot check: {e}")


def check_low_stock():
    """Scan medicineStock for items at or below reorderLevel; update device alerts."""
    print(f"[{datetime.now()}] Checking low stock...")
    try:
        all_stock = db.reference('medicineStock').get()
        if not all_stock:
            return
        for uid, stock_items in all_stock.items():
            if not stock_items:
                continue
            for stock_id, item in stock_items.items():
                qty = item.get('quantity', 0)
                reorder = item.get('reorderLevel', 10)
                is_low = qty <= reorder
                if is_low != item.get('low_stock_alert', False):
                    db.reference(f'medicineStock/{uid}/{stock_id}').update({'low_stock_alert': is_low})
                    if is_low:
                        print(f"Low stock alert: {item.get('name')} (qty {qty} ≤ reorder {reorder}) for user {uid}")
                        # Write to all device alerts as a best-effort notification
                        devices = db.reference('devices').get()
                        if devices:
                            for dev_id in devices:
                                db.reference(f'devices/{dev_id}/alerts').update({
                                    'low_stock': True,
                                    'low_stock_med': item.get('name'),
                                    'low_stock_qty': qty,
                                    'low_stock_at': datetime.now().isoformat(),
                                })
    except Exception as e:
        print(f"WARNING: Error in low stock check: {e}")


def cleanup_old_alerts():
    """Delete read alerts older than 7 days."""
    print(f"[{datetime.now()}] Cleaning up old alerts...")
    try:
        all_alerts = db.reference('alerts').get()
        if not all_alerts:
            return
        cutoff = datetime.now() - timedelta(days=7)
        for user_uid, alerts in all_alerts.items():
            if not alerts:
                continue
            for alert_id, alert_data in alerts.items():
                if alert_data.get('read') is True:
                    ts = alert_data.get('timestamp', '')
                    try:
                        if datetime.fromisoformat(ts) < cutoff:
                            db.reference(f'alerts/{user_uid}/{alert_id}').delete()
                    except Exception:
                        pass
    except Exception as e:
        print(f"WARNING: Error in alert cleanup: {e}")


# ──── internal helpers ────────────────────────────────────────────────────────

def _send_due_alert(patient_uid, slot_id, slot_data):
    meds = slot_data.get('medicines', [])
    med_label = ', '.join(meds) if meds else 'Unknown'
    print(f"Slot due for patient {patient_uid}: {med_label} (slot {slot_id})")
    try:
        medicine_data = {
            'name': med_label,
            'scheduledTime': slot_data.get('scheduledTime', ''),
            'notes': slot_data.get('notes', ''),
            'slotNumber': slot_data.get('slotNumber'),
        }
        create_patient_alert(patient_uid, medicine_data, 'medication_due')
        notify_medicine_due(patient_uid, medicine_data)
    except Exception as e:
        print(f"WARNING: Failed to send due alert: {e}")


# ──── start ───────────────────────────────────────────────────────────────────

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_medications,       'interval', minutes=1,  id='due_check')
        scheduler.add_job(check_missed_medications,'interval', minutes=5,  id='missed_check')
        scheduler.add_job(check_low_stock,         'interval', minutes=15, id='low_stock_check')
        scheduler.add_job(cleanup_old_alerts,      'cron',     hour=3, minute=0, id='alert_cleanup')
        scheduler.start()
        print("✓ Scheduler started!")
        print(f"  - Due check: every 1 min")
        print(f"  - Missed check: every 5 min (grace {GRACE_PERIOD_MINUTES} min)")
        print(f"  - Low stock check: every 15 min")
        print(f"  - Alert cleanup: daily 03:00")
