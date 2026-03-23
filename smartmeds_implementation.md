# SmartMeds Implementation Overview

SmartMeds is a full-stack IoT-enabled medication management system designed to assist patients in adhering to their medication schedules, notify caregivers of missed doses, and provide a voice-activated interface for dispensing. The system comprises a Python Flask backend and a React Native (Expo) mobile application.

---

## 🏗️ 1. Architecture Stack

### Backend
*   **Framework**: Python Flask API
*   **Database**: Firebase Admin SDK (Realtime Database & Firestore)
*   **Voice Processing**: `SpeechRecognition`, `Spacy` (NLP fallback to Regex/DiffLib), `pydub`/`ffmpeg` for audio conversion
*   **Scheduling**: `APScheduler` background service
*   **Security**: `flask-cors`, `flask-limiter`, strict security CORS headers, optional API key enforcement (`X-API-KEY` or Bearer)

### Mobile App
*   **Framework**: React Native with Expo SDK (v55.0.0)
*   **Auth & Backend**: Firebase Web v12 (`firebase/auth`, `firebase/database`)
*   **Device Specs**: `expo-audio` (recording), `expo-notifications` (push notifications)
*   **Routing**: Role-based component rendering (Patient vs. Caregiver)

---

## 🖥️ 2. Backend Implementation (`/backend`)

The backend acts as the central hub connecting the mobile app, the database, and the IoT dispensing hardware (Raspberry Pi).

### Core Components:
1.  **`app.py` (Flask Server)**
    *   Exposes REST endpoints (`/process_audio`, `/send_instruction`, `/get_todays_medicines`, `/dispense_by_time`).
    *   Integrates Firebase via a `serviceAccountKey.json` for RTDB initialization.
    *   Accepts `.m4a`/`.webM`/`.ogg` audio uploads from the mobile app, temp files them, and runs them through `ffmpeg` to produce a 16kHz `.wav` file for standard speech-to-text processing.
2.  **`nlp_utils.py` (Natural Language Processing)**
    *   Takes STT (Speech-to-Text) transcripts and uses `Spacy` Matchers or `Regex` to identify:
        *   Medicine names (e.g., "Paracetamol", "Amoxicillin") via `difflib`.
        *   Dosages (e.g., "500 mg", "2 pills").
        *   Batch Commands (e.g., "Dispense morning medicines").
3.  **`scheduler.py` (Cron Jobs & Cron Alerting)**
    *   Uses `APScheduler` to run two main daemon loops:
        *   `check_medications()` (Every 1 min): Triggers logic when a medicine is definitively due.
        *   `check_missed_medications()` (Every 5 mins): Verifies if a medicine was taken within a configured `GRACE_PERIOD_MINUTES` (30 mins). If not taken, it marks the medication as `missed`.
    *   Generates a missed alert for both the **Patient** and maps the patient UID to alert the **Caregiver**.
4.  **`notification_service.py` & `reminder_utils.py`**
    *   Interfaces with Firebase Cloud Messaging (FCM) / Expo Push servers to dispatch targeted push notifications to devices.

---

## 📱 3. Mobile Implementation (`/mobile`)

The mobile app provides dual interfaces depending on the authenticated user's role: Patient or Caregiver. 

### Core Components:
1.  **Authentication & Role Management (`App.js`)**
    *   Relies completely on `firebase/auth` `onAuthStateChanged`.
    *   On authentication success, it fetches the user details from the Firebase Realtime Database (`users/{uid}`). If the `userType` is "caregiver", it loads the `<CaregiverDashboard />`; otherwise, it loads the `<PatientDashboard />`.
2.  **Audio Module & Voice Dispensing**
    *   Uses `expo-audio` to request OS-level microphone permissions.
    *   Records user requests, bundles them into `FormData`, and POSTs them to the backend's `/process_audio` endpoint.
    *   Receives the transcribed medicine details and confirms dispensation with the user interface.
3.  **Push Notifications (`NotificationService.js`)**
    *   Utilizes `expo-notifications` to register background and foreground remote notification handlers.
    *   The generated push tokens are tied to the User's UID in Firebase, allowing the Python backend to ping the device directly when a scheduled pill is missed.
4.  **Dashboards (`src/components/`)**
    *   **PatientDashboard**: Features an intuitive view of today's schedule, voice-activation buttons, and alerts for due therapies.
    *   **CaregiverDashboard**: Fetches the list of managed patients. Displays real-time adherence rates, compliance logs, and immediate alerts if their patient misses a dosage.

---

## 🔄 4. The Functional Pipeline (A Standard Request)

**Scenario**: A patient wants to voice-dispense their 500mg Paracetamol.
1.  **Mobile**: The Patient presses the microphone button on the App. `expo-audio` records the request: *"I need my Paracetamol 500 milligram"*. 
2.  **Mobile -> Backend**: The audio blob is sent to `app.py` via the `/process_audio` endpoint.
3.  **Backend STT**: Flask uses `ffmpeg` to covert the chunk to `wav`. It feeds into Google `speech_recognition` which converts the speech to string.
4.  **Backend NLP**: The string is passed to `nlp_utils.py`. The regex matchers catch `"500 milligram"` (`extract_dosage`) and `"Paracetamol"` (`find_closest_medicine`). 
5.  **Backend Logic**: The Backend looks up the medicine slot for the specific patient in Firebase, verifies it, and returns a JSON Success Object.
6.  **Database Sync**: Mobile handles the success response and explicitly calls `/send_instruction`, transitioning the Firebase medication status to `ready_to_dispense`.
7.  **IoT Response** *(Assumed external)*: The connected hardware machine listening to Firebase RTDB watches the status flip to `ready_to_dispense` and activates its motors to dispense Slot X.
8.  **Backend Validation**: `scheduler.py` registers the interaction to avert sending a 'Medication Missed' push notification later in the day.

---
*Generated by Agent via System Analysis.*
