# SmartMeds Push Notification Setup

## Installation Instructions

### Mobile App Setup

1. **Install Expo Notifications packages:**
   ```bash
   cd /Users/sumukhamlbhat/Desktop/SmartMeds/mobile
   npm install expo-notifications expo-device expo-constants
   ```

2. **Test permissions:**
   - The app will automatically request notification permissions on login
   - For iOS: Must use real device (simulators don't support push)
   - For Android: Use emulator with Google Play Services or real device

### Backend Setup

1. **Install Python package:**
   ```bash
   cd /Users/sumukhamlbhat/Desktop/SmartMeds/backend
   pip install exponent_server_sdk
   ```

2. **Restart the backend:**
   ```bash
   python3 app.py
   ```

### Firebase Setup

1. **Upload updated database rules:**
   - Go to Firebase Console → Realtime Database → Rules
   - Copy contents from `database.rules.json`
   - Paste and click "Publish"

## How It Works

### Push Notifications Are Sent When:

1. **Medicine is Due** (`medication_due`)
   - Triggered: At scheduled time
   - Sent to: Patient
   - Example: "⏰ Medication Reminder - Time to take Paracetamol (500mg)"

2. **Medicine Dispensed** (`medicine_dispensed`)
   - Triggered: After patient takes medicine via voice
   - Sent to: Patient  
   - Example: "✅ Medicine Dispensed - Paracetamol has been successfully dispensed"

3. **Medicine Missed** (`medication_missed`)
   - Triggered: 30 minutes after scheduled time without dispensing
   - Sent to: Patient
   - Example: "❌ Missed Medicine - You missed Paracetamol at 14:00"

4. **Patient Missed Medicine** (`patient_missed_medication`)
   - Triggered: 30 minutes after scheduled time
   - Sent to: Caregiver
   - Example: "⚠️ John Doe Missed Medicine - Patient missed Paracetamol at 14:00"

### Testing Push Notifications

#### Test on Real Device:

1. **Setup:**
   - Install Expo Go app on phone 
   - Connect to same network as development machine
   - Run: `npm start` in mobile directory
   - Scan QR code with Expo Go

2. **Test Medicine Due:**
   - Add medicine with scheduledTime = current time + 2 minutes
   - Wait 2 minutes
   - Should receive push notification on phone

3. **Test Medicine Dispensed:**
   - Say medicine name via voice command
   - Should receive confirmation notification

4. **Test Missed Medicine:**
   - Add medicine with scheduledTime = current time + 2 minutes
   - Wait 32 minutes without dispensing
   - Patient should receive "missed" notification
   - Caregiver should receive "patient missed" notification

## Troubleshooting

### "No push token" in logs
- Check if device is physical (not simulator)
- Check if permissions were granted
- Check Firebase rules allow pushToken field

### Notifications not received
- Verify backend is running
- Check push token saved in Firebase: `/users/{uid}/pushToken`
- Check Expo services status
- Verify internet connection

### Token errors in backend
- Install: `pip install exponent_server_sdk`
- Check token format starts with "ExponentPushToken["

## Important Notes

- **Development:** Push notifications work with Expo Go app
- **Production:** Need standalone build for production push notifications
- **Rate Limits:** Expo has rate limits on free tier
- **iOS Simulator:** Does NOT support push notifications (use real device)
- **Android Emulator:** Requires Google Play Services

## Files Created/Modified

### New Files:
- `mobile/src/services/NotificationService.js` - Notification handling
- `backend/notification_service.py` - Push notification sending

### Modified Files:
- `mobile/App.js` - Register for notifications
- `mobile/src/components/patient/AudioRecorder.js` - Send notification after dispense
- `backend/scheduler.py` - Send notifications for due/missed medicines
- `backend/requirements.txt` - Added exponent_server_sdk
- `database.rules.json` - Allow pushToken field
