#!/usr/bin/env python3
"""
SmartMeds Raspberry Pi Listener
Monitors Firebase for medicine dispense requests and controls physical dispenser.
"""

import firebase_admin
from firebase_admin import credentials, db
import time
import sys

# Configuration
PATIENT_UID = "YOUR_PATIENT_UID_HERE"  # Replace with actual patient UID
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
DATABASE_URL = "https://smartmeds-9b931-default-rtdb.firebaseio.com"

# Motor Configuration for 8-Slot Rotary Dispenser
TOTAL_SLOTS = 8
DEGREES_PER_SLOT = 360 / TOTAL_SLOTS  # 45 degrees per slot

# Slot to rotation angle mapping (in degrees)
# Assuming slot 1 is at 0 degrees (starting position)
SLOT_TO_ANGLE = {
    1: 0,      # 0°
    2: 45,     # 45°
    3: 90,     # 90°
    4: 135,    # 135°
    5: 180,    # 180°
    6: 225,    # 225°
    7: 270,    # 270°
    8: 315     # 315°
}

# Initialize Firebase
try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {
        'databaseURL': DATABASE_URL
    })
    print("✅ Firebase initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize Firebase: {e}")
    sys.exit(1)


def rotate_motor_to_slot(slot_number):
    """
    Rotate the motor to align the specified slot with the dispensing opening.
    
    Args:
        slot_number (int): Slot number (1-8)
    
    Returns:
        int: Rotation angle in degrees
    """
    if slot_number not in SLOT_TO_ANGLE:
        raise ValueError(f"Invalid slot number: {slot_number}. Must be 1-{TOTAL_SLOTS}")
    
    angle = SLOT_TO_ANGLE[slot_number]
    print(f"🔄 Rotating motor to {angle}° (Slot {slot_number})")
    
    # TODO: Add your motor control code here
    # Example using a stepper motor library:
    # 
    # from adafruit_motor import stepper
    # from adafruit_motorkit import MotorKit
    # 
    # kit = MotorKit()
    # steps_per_revolution = 200  # Typical for NEMA 17 stepper
    # steps_per_degree = steps_per_revolution / 360
    # steps_to_move = int(angle * steps_per_degree)
    # 
    # for _ in range(steps_to_move):
    #     kit.stepper1.onestep(direction=stepper.FORWARD, style=stepper.DOUBLE)
    #     time.sleep(0.01)
    
    # For now, simulate rotation
    time.sleep(0.5)
    return angle


def dispense_from_slot(slot_number, medicine_name):
    """
    Control the physical dispenser to dispense medicine from the specified slot.
    
    Args:
        slot_number (int): Slot number (1-8)
        medicine_name (str): Name of medicine for logging
    """
    print(f"🔧 Dispensing {medicine_name} from slot {slot_number}...")
    
    try:
        # Step 1: Rotate to correct slot
        angle = rotate_motor_to_slot(slot_number)
        print(f"✅ Motor rotated to {angle}° (Slot {slot_number} aligned)")
        
        # Step 2: Activate dispensing mechanism
        # TODO: Add your dispensing mechanism code here
        # This could be:
        # - A servo to push the medicine out
        # - A solenoid to open a gate
        # - Another motor to dispense
        # 
        # Example with servo:
        # from adafruit_servokit import ServoKit
        # kit = ServoKit(channels=16)
        # kit.servo[0].angle = 90  # Push
        # time.sleep(1)
        # kit.servo[0].angle = 0   # Retract
        
        # For now, simulate dispensing
        print(f"💊 Dispensing mechanism activated...")
        time.sleep(1)
        
        print(f"✅ Dispensed {medicine_name} from slot {slot_number}")
        
    except Exception as e:
        print(f"❌ Error dispensing from slot {slot_number}: {e}")
        raise



def handle_medicine_update(medicine_id, medicine_data):
    """
    Handle updates to medicine data. Dispense if status is 'ready_to_dispense'.
    
    Args:
        medicine_id (str): Firebase medicine document ID
        medicine_data (dict): Medicine data from Firebase
    """
    status = medicine_data.get('status')
    
    if status == 'ready_to_dispense':
        slot = medicine_data.get('slot')
        name = medicine_data.get('name')
        dosage = medicine_data.get('dosage', '')
        
        print(f"\n🔔 DISPENSE REQUEST DETECTED")
        print(f"   Medicine: {name}")
        print(f"   Slot: {slot}")
        print(f"   Dosage: {dosage}")
        
        try:
            # Update status to 'dispensing'
            medicine_ref = db.reference(f'medicines/{PATIENT_UID}/{medicine_id}')
            medicine_ref.update({'status': 'dispensing'})
            print(f"📝 Status updated to 'dispensing'")
            
            # Dispense the medicine
            dispense_from_slot(slot, name)
            
            # Update status to 'dispensed'
            medicine_ref.update({
                'status': 'dispensed',
                'dispensedAt': time.strftime('%Y-%m-%dT%H:%M:%S')
            })
            print(f"✅ Status updated to 'dispensed'\n")
            
        except Exception as e:
            print(f"❌ Error during dispensing: {e}")
            # Update status to 'error' for debugging
            try:
                medicine_ref.update({
                    'status': 'error',
                    'errorMessage': str(e)
                })
            except:
                pass


def on_medicine_change(event):
    """
    Callback for Firebase value changes on medicines.
    
    Args:
        event: Firebase event object
    """
    # Get the medicine ID from the path
    path_parts = event.path.strip('/').split('/')
    if len(path_parts) == 0:
        # Initial load or full medicines list change
        medicines_data = event.data
        if medicines_data:
            for medicine_id, medicine_data in medicines_data.items():
                handle_medicine_update(medicine_id, medicine_data)
    else:
        # Single medicine update
        medicine_id = path_parts[0]
        medicine_data = event.data
        if medicine_data:
            handle_medicine_update(medicine_id, medicine_data)


def main():
    """Main monitoring loop."""
    print(f"👂 Starting SmartMeds Raspberry Pi Listener...")
    print(f"   Patient UID: {PATIENT_UID}")
    print(f"   Monitoring: medicines/{PATIENT_UID}")
    print(f"   Status: Waiting for dispense requests...\n")
    
    # Listen to all medicines for this patient
    medicines_ref = db.reference(f'medicines/{PATIENT_UID}')
    medicines_ref.listen(on_medicine_change)
    
    # Keep the script running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down listener...")
        sys.exit(0)


if __name__ == "__main__":
    main()
