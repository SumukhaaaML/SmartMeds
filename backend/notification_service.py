"""
Notification service for sending push notifications via Expo
Handles sending notifications to patients and caregivers
"""

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError
from firebase_admin import db


def send_push_notification(push_token, title, body, data=None):
    """
    Send a single push notification using Expo's push notification service.
    
    Args:
        push_token (str): Expo push token
        title (str): Notification title
        body (str): Notification body
        data (dict): Additional data to send with notification
        
    Returns:
        dict: Response from Expo or None if failed
    """
    try:
        # Validate token format
        if not push_token or not push_token.startswith('ExponentPushToken'):
            print(f"Invalid push token format: {push_token}")
            return None
        
        # Create push message
        message = PushMessage(
            to=push_token,
            title=title,
            body=body,
            data=data or {},
            sound='default',
            priority='high',
            channel_id='medication'  # Android channel
        )
        
        # Send notification
        response = PushClient().publish(message)
        
        print(f"✓ Sent push notification: {title}")
        return response
        
    except PushServerError as exc:
        # Encountered some likely formatting issues
        print(f"Push server error: {exc.errors}")
        print(f"Push response data: {exc.response_data}")
        return None
        
    except DeviceNotRegisteredError:
        # Token is no longer valid, should remove it from database
        print(f"Device not registered for token: {push_token}")
        return None
        
    except Exception as e:
        print(f"Error sending push notification: {e}")
        return None


def send_multiple_notifications(messages):
    """
    Send multiple push notifications in batch.
    
    Args:
        messages (list): List of PushMessage objects
        
    Returns:
        list: List of responses
    """
    try:
        responses = PushClient().publish_multiple(messages)
        print(f"✓ Sent {len(messages)} push notifications")
        return responses
    except Exception as e:
        print(f"Error sending batch notifications: {e}")
        return []


def get_user_push_token(uid):
    """
    Get user's push token from Firebase Realtime Database.
    
    Args:
        uid (str): User UID
        
    Returns:
        str: Push token or None if not found
    """
    try:
        user_ref = db.reference(f'users/{uid}')
        user_data = user_ref.get()
        
        if user_data and 'pushToken' in user_data:
            return user_data['pushToken']
        else:
            print(f"No push token found for user {uid}")
            return None
            
    except Exception as e:
        print(f"Error fetching push token for {uid}: {e}")
        return None


def notify_medicine_due(patient_uid, medicine_data):
    """
    Send notification when medicine is due.
    
    Args:
        patient_uid (str): Patient UID
        medicine_data (dict): Medicine information
    """
    token = get_user_push_token(patient_uid)
    if not token:
        return
    
    medicine_name = medicine_data.get('name', 'Medicine')
    dosage = medicine_data.get('dosage', '')
    scheduled_time = medicine_data.get('scheduledTime', '')
    
    title = '⏰ Medication Reminder'
    body = f"Time to take {medicine_name}" + (f" ({dosage})" if dosage else "")
    if scheduled_time:
        body += f" - Scheduled for {scheduled_time}"
    
    send_push_notification(
        push_token=token,
        title=title,
        body=body,
        data={
            'type': 'medication_due',
            'medicineName': medicine_name,
            'scheduledTime': scheduled_time
        }
    )


def notify_medicine_dispensed(patient_uid, medicine_name):
    """
    Send notification after medicine is dispensed.
    
    Args:
        patient_uid (str): Patient UID
        medicine_name (str): Medicine name
    """
    token = get_user_push_token(patient_uid)
    if not token:
        return
    
    send_push_notification(
        push_token=token,
        title='✅ Medicine Dispensed',
        body=f"{medicine_name} has been successfully dispensed",
        data={
            'type': 'medicine_dispensed',
            'medicineName': medicine_name
        }
    )


def notify_medicine_missed(patient_uid, medicine_data):
    """
    Send notification when medicine is missed.
    
    Args:
        patient_uid (str): Patient UID
        medicine_data (dict): Medicine information
    """
    token = get_user_push_token(patient_uid)
    if not token:
        return
    
    medicine_name = medicine_data.get('name', 'Medicine')
    scheduled_time = medicine_data.get('scheduledTime', '')
    
    send_push_notification(
        push_token=token,
        title='❌ Missed Medicine',
        body=f"You missed {medicine_name}" + (f" at {scheduled_time}" if scheduled_time else ""),
        data={
            'type': 'medication_missed',
            'medicineName': medicine_name,
            'scheduledTime': scheduled_time
        }
    )


def notify_caregiver_patient_missed(caregiver_uid, patient_name, medicine_data):
    """
    Send notification to caregiver when patient misses medicine.
    
    Args:
        caregiver_uid (str): Caregiver UID
        patient_name (str): Patient name or email
        medicine_data (dict): Medicine information
    """
    token = get_user_push_token(caregiver_uid)
    if not token:
        return
    
    medicine_name = medicine_data.get('name', 'Medicine')
    scheduled_time = medicine_data.get('scheduledTime', '')
    
    send_push_notification(
        push_token=token,
        title=f'⚠️ {patient_name} Missed Medicine',
        body=f"Patient missed {medicine_name}" + (f" at {scheduled_time}" if scheduled_time else ""),
        data={
            'type': 'patient_missed_medication',
            'patientName': patient_name,
            'medicineName': medicine_name,
            'scheduledTime': scheduled_time
        }
    )


__all__ = [
    'send_push_notification',
    'send_multiple_notifications',
    'get_user_push_token',
    'notify_medicine_due',
    'notify_medicine_dispensed',
    'notify_medicine_missed',
    'notify_caregiver_patient_missed'
]
