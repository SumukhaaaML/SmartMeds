import time
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
import firebase_admin
from firebase_admin import db
from reminder_utils import (
    is_medication_missed,
    get_caregiver_for_patient,
    create_patient_alert,
    create_caregiver_alert,
    has_existing_missed_alert,
    mark_medicine_as_missed
)
from notification_service import (
    notify_medicine_due,
    notify_medicine_missed,
    notify_caregiver_patient_missed
)

# Initialize Scheduler
scheduler = BackgroundScheduler()

# Configuration
GRACE_PERIOD_MINUTES = 30  # Time to wait before marking as missed


def check_medications():
    """
    Checks all patients' medication schedules and triggers alerts if due.
    Runs every minute to catch medications at their scheduled time.
    """
    print(f"[{datetime.now()}] Checking due medications...")
    
    try:
        # Fetch all medicines from Realtime Database
        medicines_ref = db.reference('medicines')
        all_medicines = medicines_ref.get()
        
        if not all_medicines:
            return
        
        current_time = datetime.now().strftime("%H:%M")  # Format: HH:MM
        
        for patient_uid, medicines in all_medicines.items():
            if not medicines:
                continue
                
            for medicine_id, med_data in medicines.items():
                scheduled_time = med_data.get('scheduledTime')
                
                # Check if medicine is due now
                if scheduled_time == current_time:
                    # Check if already dispensed today
                    if med_data.get('status') != 'dispensed':
                        send_due_alert(patient_uid, med_data)
                        
    except Exception as e:
        print(f"WARNING: Error in medication due check: {e}")


def check_missed_medications():
    """
    Checks for medications that were not taken after the grace period.
    Runs every 5 minutes to detect missed medications and alert caregivers.
    """
    print(f"[{datetime.now()}] Checking for missed medications...")
    
    try:
        medicines_ref = db.reference('medicines')
        all_medicines = medicines_ref.get()
        
        if not all_medicines:
            return
        
        for patient_uid, medicines in all_medicines.items():
            if not medicines:
                continue
            
            for medicine_id, med_data in medicines.items():
                scheduled_time = med_data.get('scheduledTime')
                
                if not scheduled_time:
                    continue
                
                # Check if medication is missed (past grace period)
                if is_medication_missed(scheduled_time, GRACE_PERIOD_MINUTES):
                    status = med_data.get('status', '')
                    medicine_name = med_data.get('name', 'Unknown')
                    
                    # Only alert if not already dispensed or missed
                    if status not in ['dispensed', 'missed']:
                        # Check if we already created a missed alert today
                        if not has_existing_missed_alert(patient_uid, medicine_name, scheduled_time):
                            # Create patient alert
                            create_patient_alert(patient_uid, med_data, 'medication_missed')
                            
                            # Send push notification to patient
                            notify_medicine_missed(patient_uid, med_data)
                            
                            # Mark medicine as missed
                            mark_medicine_as_missed(patient_uid, medicine_id)
                            
                            # Get patient info and notify caregiver
                            patient_ref = db.reference(f'users/{patient_uid}')
                            patient_data = patient_ref.get()
                            patient_name = patient_data.get('email', '') if patient_data else patient_uid
                            
                            # Find and notify caregiver
                            caregiver_uid = get_caregiver_for_patient(patient_uid)
                            if caregiver_uid:
                                create_caregiver_alert(caregiver_uid, patient_uid, patient_name, med_data)
                                # Send push notification to caregiver
                                notify_caregiver_patient_missed(caregiver_uid, patient_name, med_data)
                                print(f"Notified caregiver {caregiver_uid} about patient {patient_uid} missing {medicine_name}")
                            else:
                                print(f"No caregiver found for patient {patient_uid}")
                        
    except Exception as e:
        print(f"WARNING: Error in missed medication check: {e}")


def send_due_alert(patient_uid, medicine_data):
    """
    Sends an alert when medication is due.
    
    Args:
        patient_uid: Patient UID
        medicine_data: Medicine information dictionary
    """
    print(f"Medicine due for patient {patient_uid}: {medicine_data.get('name')}")
    
    try:
        # Create "medication due" alert for patient
        create_patient_alert(patient_uid, medicine_data, 'medication_due')
        
        # Send push notification
        notify_medicine_due(patient_uid, medicine_data)
        
    except Exception as e:
        print(f"WARNING: Failed to send due alert: {e}")


def cleanup_old_alerts():
    """
    Clean up old read alerts (older than 7 days) to prevent database bloat.
    Runs daily.
    """
    print(f"[{datetime.now()}] Cleaning up old alerts...")
    
    try:
        from datetime import timedelta
        
        alerts_ref = db.reference('alerts')
        all_alerts = alerts_ref.get()
        
        if not all_alerts:
            return
        
        cutoff_date = datetime.now() - timedelta(days=7)
        
        for user_uid, alerts in all_alerts.items():
            if not alerts:
                continue
                
            for alert_id, alert_data in alerts.items():
                # Remove old read alerts
                if alert_data.get('read') == True:
                    timestamp_str = alert_data.get('timestamp', '')
                    try:
                        alert_time = datetime.fromisoformat(timestamp_str)
                        if alert_time < cutoff_date:
                            alert_ref = db.reference(f'alerts/{user_uid}/{alert_id}')
                            alert_ref.delete()
                            print(f"Deleted old alert {alert_id} for user {user_uid}")
                    except:
                        pass
                        
    except Exception as e:
        print(f"WARNING: Error in alert cleanup: {e}")


def start_scheduler():
    """Start the background scheduler with all jobs."""
    if not scheduler.running:
        # Check for due medications every minute
        scheduler.add_job(check_medications, 'interval', minutes=1, id='due_check')
        
        # Check for missed medications every 5 minutes
        scheduler.add_job(check_missed_medications, 'interval', minutes=5, id='missed_check')
        
        # Cleanup old alerts daily at 3 AM
        scheduler.add_job(cleanup_old_alerts, 'cron', hour=3, minute=0, id='alert_cleanup')
        
        scheduler.start()
        print("✓ Scheduler started!")
        print("  - Checking due medications every 1 minute")
        print("  - Checking missed medications every 5 minutes")
        print(f"  - Grace period: {GRACE_PERIOD_MINUTES} minutes")
        print("  - Daily alert cleanup at 3 AM")

