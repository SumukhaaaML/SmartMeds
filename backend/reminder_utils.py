"""
Utility functions for medication reminder system.
Handles alert creation, missed medication detection, and caregiver notifications.
"""

from datetime import datetime, timedelta
from firebase_admin import db

def is_medication_missed(scheduled_time_str, grace_period_minutes=30):
    """
    Check if a medication is considered missed based on scheduled time and grace period.
    
    Args:
        scheduled_time_str: Scheduled time in "HH:MM" format
        grace_period_minutes: Minutes to wait before marking as missed
        
    Returns:
        Boolean indicating if medication is missed
    """
    try:
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        scheduled_datetime = datetime.strptime(f"{today_str} {scheduled_time_str}", "%Y-%m-%d %H:%M")
        
        # Add grace period
        missed_threshold = scheduled_datetime + timedelta(minutes=grace_period_minutes)
        
        # Check if current time is past the threshold
        return now > missed_threshold
    except Exception as e:
        print(f"Error checking if medication is missed: {e}")
        return False


def get_caregiver_for_patient(patient_uid):
    """
    Find the caregiver assigned to a specific patient.
    
    Args:
        patient_uid: UID of the patient
        
    Returns:
        Caregiver UID if found, None otherwise
    """
    try:
        # Search through all caregivers to find one that has this patient
        caregivers_ref = db.reference('caregivers')
        caregivers_data = caregivers_ref.get()
        
        if not caregivers_data:
            return None
        
        for caregiver_uid, caregiver_data in caregivers_data.items():
            patients = caregiver_data.get('patients', {})
            if patient_uid in patients:
                return caregiver_uid
                
        return None
    except Exception as e:
        print(f"Error finding caregiver for patient {patient_uid}: {e}")
        return None


def create_patient_alert(patient_uid, medicine_data, alert_type="medication_missed"):
    """
    Create an alert for a patient about their medication.
    
    Args:
        patient_uid: UID of the patient
        medicine_data: Dictionary containing medicine information
        alert_type: Type of alert (medication_due, medication_missed, etc.)
        
    Returns:
        Alert ID if successful, None otherwise
    """
    try:
        alerts_ref = db.reference(f'alerts/{patient_uid}')
        new_alert = alerts_ref.push()
        
        alert_data = {
            'type': alert_type,
            'medicineName': medicine_data.get('name', 'Unknown'),
            'dosage': medicine_data.get('dosage', ''),
            'scheduledTime': medicine_data.get('scheduledTime', ''),
            'timestamp': datetime.now().isoformat(),
            'read': False
        }
        
        # Add caregiver ID if available
        caregiver_id = get_caregiver_for_patient(patient_uid)
        if caregiver_id:
            alert_data['caregiverId'] = caregiver_id
        
        new_alert.set(alert_data)
        print(f"Created {alert_type} alert for patient {patient_uid}: {medicine_data.get('name')}")
        
        return new_alert.key
    except Exception as e:
        print(f"Error creating patient alert: {e}")
        return None


def create_caregiver_alert(caregiver_uid, patient_uid, patient_name, medicine_data):
    """
    Create an alert for a caregiver about their patient's missed medication.
    
    Args:
        caregiver_uid: UID of the caregiver
        patient_uid: UID of the patient
        patient_name: Name of the patient for display
        medicine_data: Dictionary containing medicine information
        
    Returns:
        Alert ID if successful, None otherwise
    """
    try:
        # Create alert in caregiver's alerts section
        alerts_ref = db.reference(f'alerts/{caregiver_uid}')
        new_alert = alerts_ref.push()
        
        alert_data = {
            'type': 'patient_missed_medication',
            'patientId': patient_uid,
            'patientName': patient_name or patient_uid,
            'medicineName': medicine_data.get('name', 'Unknown'),
            'dosage': medicine_data.get('dosage', ''),
            'scheduledTime': medicine_data.get('scheduledTime', ''),
            'timestamp': datetime.now().isoformat(),
            'read': False
        }
        
        new_alert.set(alert_data)
        print(f"Created caregiver alert for {caregiver_uid} about patient {patient_uid}")
        
        return new_alert.key
    except Exception as e:
        print(f"Error creating caregiver alert: {e}")
        return None


def has_existing_missed_alert(patient_uid, medicine_name, scheduled_time):
    """
    Check if a missed alert already exists for this medicine today.
    
    Args:
        patient_uid: Patient UID
        medicine_name: Name of the medicine
        scheduled_time: Scheduled time in HH:MM format
        
    Returns:
        Boolean indicating if alert exists
    """
    try:
        alerts_ref = db.reference(f'alerts/{patient_uid}')
        alerts_data = alerts_ref.get()
        
        if not alerts_data:
            return False
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        for alert_id, alert_data in alerts_data.items():
            # Check if it's a missed alert for this medicine today
            if (alert_data.get('type') == 'medication_missed' and
                alert_data.get('medicineName') == medicine_name and
                alert_data.get('scheduledTime') == scheduled_time):
                
                # Check if alert was created today
                alert_timestamp = alert_data.get('timestamp', '')
                if alert_timestamp.startswith(today):
                    return True
                    
        return False
    except Exception as e:
        print(f"Error checking for existing alert: {e}")
        return False


def mark_medicine_as_missed(patient_uid, medicine_id):
    """
    Update medicine status to indicate it was missed.
    
    Args:
        patient_uid: Patient UID
        medicine_id: Medicine ID
    """
    try:
        medicine_ref = db.reference(f'medicines/{patient_uid}/{medicine_id}')
        medicine_ref.update({
            'status': 'missed',
            'missedAt': datetime.now().isoformat()
        })
        print(f"Marked medicine {medicine_id} as missed for patient {patient_uid}")
    except Exception as e:
        print(f"Error marking medicine as missed: {e}")


__all__ = [
    'is_medication_missed',
    'get_caregiver_for_patient',
    'create_patient_alert',
    'create_caregiver_alert',
    'has_existing_missed_alert',
    'mark_medicine_as_missed'
]
