SmartMeds Mobile (Expo)

This is a minimal Expo React Native app that mirrors the web frontend logic:
- record audio
- upload to backend `/process_audio` (multipart/form-data field `audio`)
- display transcript and detected medicine
- send dispense instruction to `/send_instruction`

Quick start
1. Install dependencies:

```bash
cd mobile
npm install
```

2. Start Expo

```bash
npx expo start
```

3. On a real device, ensure the backend (`backend/app.py`) is reachable from the device. Replace the `BACKEND` constant in `App.js` with your machine IP, e.g. `http://192.168.1.100:5000`.

Notes
- The app uses `expo-av` to record audio. The recording is uploaded as the recorded file (usually `m4a`). The backend will attempt conversion (pydub/ffmpeg) if needed. If you prefer, the backend can also accept the raw file if you install `ffmpeg`.
- Do not change any business logic; this app mirrors the web flow.
