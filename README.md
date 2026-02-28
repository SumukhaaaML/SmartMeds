# SmartMeds — Voice-controlled medicine dispenser (demo)

This repository contains a small demo frontend and Flask backend that lets you record voice commands (medicine name + dosage), transcribes them, extracts medicine and dosage, and can forward a dispense instruction to a Raspberry Pi endpoint.

Quick features
- Record audio in the browser and upload to backend
- Server-side transcription using SpeechRecognition (Google recognizer)
- NLP helpers using spaCy (with regex fallback)
- /send_instruction endpoint to forward instructions to a configurable Raspberry Pi endpoint

Requirements
- macOS / Linux / Windows with Python 3.8+
- Microphone and modern browser (Chrome/Edge/Safari)

Quick start (recommended)
1. Make script executable and run it:

```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

2. Open the frontend at http://127.0.0.1:8000
3. Click "Start Recording", speak a medicine (e.g., "Paracetamol 500 mg"), stop, then press "Dispense" to send instruction.

Configure Raspberry Pi forwarding
- Set environment variable `RPI_ENDPOINT` before running backend. Example:

```bash
export RPI_ENDPOINT="http://raspberrypi.local:8000/execute"
./scripts/run.sh
```

Protect dispense actions with an API key
- Set an API key in the backend environment variable `SMARTMEDS_API_KEY` to require a key for dispense commands. Example:

```bash
export SMARTMEDS_API_KEY="super-secret-key"
./scripts/run.sh
```

 - In the frontend you can paste the same API key into the "API Key" field before pressing Dispense. The frontend will send the Authorization: Bearer <key> header.

Run tests

```bash
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```

Notes & next steps
- Dosage extraction uses spaCy when `en_core_web_sm` is installed; otherwise a regex fallback is used. For better production extraction, consider training a custom NER model or integrating an external NLU.
- The backend currently uses no authentication — add it if you run on an open network.
# SmartMeds
# SmartMeds
