# Backend Setup Guide - Firebase Integration

##  Features Enabled:
1. **Caregiver adds medicines for patients** via React UI
2. **Backend reads patient-specific medicines** from Firebase Firestore
3. **Voice commands matched against patient's medicines** (not just default list)
4. **Real-time sync** between caregiver dashboard and backend

## 🔧 Setup Steps:

### 1. Get Firebase Admin Credentials
- Go to **Firebase Console** → Your Project → **Project Settings**
- Click **Service Accounts** tab
- Click **Generate New Private Key**
- Save the JSON file as `serviceAccountKey.json` in the `backend` folder

### 2. Install Dependencies
```bash
cd /Users/sumukhamlbhat/Desktop/SmartMeds
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Run the Backend
```bash
export FIREBASE_CREDENTIALS_PATH="/Users/sumukhamlbhat/Desktop/SmartMeds/backend/serviceAccountKey.json"
cd backend
python3 app.py
```

### 4. Test the Integration

**Step A: Caregiver adds medicines**
1. Open React UI and sign up as **Caregiver**
2. Add a **Patient** by email
3. Click the patient to select
4. Add medicines: e.g., "Aspirin", "Cough Syrup", "Dolo 500"

**Step B: Patient uses voice commands**
1. Open React UI and sign up as **Patient** (use same email from caregiver's add)
2. Click microphone and say: *"Dispense Aspirin"*
3. Backend will:
   - ✅ Load medicines added by caregiver
   - ✅ Match "Aspirin" against patient's list
   - ✅ Return success with audio beep
   - ✅ Auto-add reminder

## 📊 Expected Firebase Structure:

```
Firestore:
  users/{patientUid}/
    medicines/
      {docId1}: { name: "Aspirin", dosage: "500mg" }
      {docId2}: { name: "Cough Syrup", dosage: "As prescribed" }

RTDB:
  users/{patientUid}/
    name: "John Doe"
    email: "john@email.com"
    userType: "patient"
  
  caregivers/{caregiverUid}/
    patients/{patientUid}/
      name: "John Doe"
      email: "john@email.com"
```

## 🐛 Troubleshooting:

**Issue: Firebase credentials not found**
- Solution: Make sure `serviceAccountKey.json` is in `/Users/sumukhamlbhat/Desktop/SmartMeds/backend/`
- Run: `export FIREBASE_CREDENTIALS_PATH="/full/path/to/serviceAccountKey.json"`

**Issue: "⚠️  Firebase Admin SDK not available"**
- Solution: Run `pip install firebase-admin==6.2.0`

**Issue: Backend doesn't recognize patient medicines**
- Solution: Make sure:
  1. Caregiver added patient (by email)
  2. Caregiver added medicines for patient
  3. Patient is signed in with SAME email
  4. Backend is running with FIREBASE_CREDENTIALS_PATH set

**Issue: Voice commands still matching default medicines**
- Solution: Backend needs patient_uid parameter
  - Verify React Home.jsx is passing `?patient_uid=${user.uid}` in fetch URL
  - Check backend console for: "✅ Loaded X medicines from Firebase"

## 🎯 How It Works:

1. **Caregiver Dashboard** (React)
   - Add patients by email ✓
   - Add medicines for each patient ✓
   - Saves to Firestore

2. **Patient Signs In** (React)
   - Loads medicines added by caregiver
   - Ready to use voice commands

3. **Voice Command** (React → Backend → RPI)
   - Frontend: Captures audio + passes patient_uid to backend
   - Backend: Fetches patient's medicines from Firestore
   - Backend: Matches voice against patient's medicines
   - Backend: Sends to Raspberry Pi (or simulates)
   - Frontend: Plays audio confirmation + adds reminder

## ✨ Next Steps:
- [ ] Download serviceAccountKey.json from Firebase Console
- [ ] Place it in `backend/` folder
- [ ] Run `pip install -r backend/requirements.txt`
- [ ] Set environment variable and start backend
- [ ] Test caregiver → patient → voice command flow
