# SmartMeds React Frontend

Modern React web frontend for the SmartMeds voice-powered medicine dispenser app using Vite + Firebase.

## Features

✅ **Firebase Authentication** – Email/password login and signup  
✅ **Per-user Medicine Lists** – Medicines stored in Firestore (seeded on signup)  
✅ **Voice Recording** – Record audio directly in browser using Web Audio API  
✅ **NLP Backend Integration** – Send audio to Flask backend for processing  
✅ **Real-time Results** – Display detected medicine, dosage, and transcript  
✅ **RPI Integration** – Send dispense instructions via Flask backend  
✅ **Modern UI** – Gradient backgrounds, animations, responsive design  

## Setup

### Prerequisites

- Node.js 16+ and npm
- Backend Flask server running on `http://127.0.0.1:5000` (or update `BACKEND` in `src/Home.jsx`)

### Installation

```bash
cd frontend-react
npm install
```

### Development

```bash
npm run dev
```

Starts Vite dev server on `http://localhost:5173` (opens automatically).

### Build

```bash
npm run build
```

Production-ready build output in `dist/`.

### Preview

```bash
npm run preview
```

Locally preview the production build.

## Project Structure

```
frontend-react/
├── index.html              # Vite entry HTML
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies and scripts
└── src/
    ├── main.jsx            # React app entry
    ├── App.jsx             # Main router (auth → home)
    ├── Login.jsx           # Login form component
    ├── Signup.jsx          # Signup form with password strength
    ├── Home.jsx            # Main app (record/upload/display)
    ├── firebase.js         # Firebase config and exports
    ├── auth.css            # Authentication UI styles
    └── app.css             # Main app styles
```

## Configuration

### Backend URL

Edit `src/Home.jsx` line 6 to point to your Flask backend:

```javascript
const BACKEND = 'http://YOUR_IP:5000';
```

If testing on a mobile device or different machine, use:

```javascript
const BACKEND = 'http://192.168.1.X:5000'; // Your machine IP
```

### Firebase Config

Firebase config is embedded in `src/firebase.js`. If you need to change it:

1. Open `src/firebase.js`
2. Update the `firebaseConfig` object with your credentials
3. Save and rebuild

## Features Walkthrough

### 1. Authentication

- **Login**: Sign in with email/password via Firebase Auth
- **Signup**: Create new account and auto-seed default medicines (Paracetamol, Ibuprofen, Aspirin, Metformin)
- **Persistent Session**: Logged-in state persists across page reloads

### 2. Main App (Signed In)

- **Record Audio**: Click "Start Recording" → "Stop Recording" to capture voice
- **Upload & Process**: Audio sent to Flask backend for speech recognition and NLP
- **Display Results**:
  - Transcript: Raw speech-to-text output
  - Detected Medicine: Matched medicine name (fuzzy matching)
  - Dosage: Extracted dosage from transcript
- **Send Instruction**: Click "Send Instruction" to dispatch to Raspberry Pi
- **Per-user Medicines**: Your medicines list shown at bottom (loaded from Firestore)

### 3. Logout

Click "Sign Out" in the header to logout and return to login screen.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Audio not working** | Check browser microphone permissions and HTTPS (if remote) |
| **Backend errors** | Verify Flask server is running on configured BACKEND URL |
| **Firebase auth errors** | Check Firebase credentials in `src/firebase.js` and internet connectivity |
| **Medicines not loading** | Ensure you've signed up (default medicines are seeded on signup) |
| **CORS errors** | Ensure Flask backend has CORS enabled for your frontend URL |

## Dependencies

- **react** 18.2.0 – UI framework
- **react-dom** 18.2.0 – React DOM renderer
- **firebase** 9.22.2 – Firebase SDK (auth + firestore)
- **vite** 5.0.0 – Build tool
- **@vitejs/plugin-react** 4.2.0 – Vite React plugin

## Scripts

```bash
npm run dev       # Start dev server (port 5173)
npm run build     # Build for production
npm run preview   # Preview production build locally
```

## Notes

- Backend expects audio as `multipart/form-data` with `audio` field
- Default medicines seeded on signup: Paracetamol, Ibuprofen, Aspirin, Metformin
- Web Audio API for recording (WebM format)
- 30-second timeout for audio upload
- Responsive design works on desktop, tablet, and mobile

---

Built with ❤️ for SmartMeds
