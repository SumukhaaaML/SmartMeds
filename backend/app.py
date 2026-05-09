from flask import Flask, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
import logging
import speech_recognition as sr
import tempfile
import subprocess
from datetime import datetime
from nlp_utils import find_closest_medicine, extract_dosage
from validators import validate_uid

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, db, firestore
    FIREBASE_AVAILABLE = True
except Exception as e:
    logging.warning("Firebase Admin SDK not available: %s", e)
    FIREBASE_AVAILABLE = False

# Optional: use pydub to convert mobile audio formats (m4a, ogg, webm) to WAV
try:
    from pydub import AudioSegment  # type: ignore
    PYDUB_AVAILABLE = True
except Exception:
    AudioSegment = None
    PYDUB_AVAILABLE = False

def check_ffmpeg_available():
    """Check if ffmpeg is installed and accessible."""
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
        return True
    except Exception:
        return False

FFMPEG_AVAILABLE = check_ffmpeg_available()


def as_bool(value, default=False):
    """Parse env bools safely."""
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def get_default_firebase_credentials_path():
    """Use backend-local credentials file by default."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(backend_dir, "serviceAccountKey.json")


APP_ENV = os.getenv("APP_ENV", os.getenv("FLASK_ENV", "development")).lower()
IS_PRODUCTION = APP_ENV == "production"

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("smartmeds.backend")

# Initialize Firebase
if FIREBASE_AVAILABLE:
    try:
        if os.getenv("FIREBASE_CREDENTIALS_JSON"):
            import json
            cred_dict = json.loads(os.getenv("FIREBASE_CREDENTIALS_JSON"))
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred, {
                "databaseURL": os.getenv("FIREBASE_DATABASE_URL", "https://smartmeds-9b931-default-rtdb.firebaseio.com")
            })
            logger.info("Firebase initialized successfully from JSON environment variable")
        else:
            creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", get_default_firebase_credentials_path())
            if os.path.exists(creds_path):
                cred = credentials.Certificate(creds_path)
                firebase_admin.initialize_app(cred, {
                    "databaseURL": os.getenv("FIREBASE_DATABASE_URL", "https://smartmeds-9b931-default-rtdb.firebaseio.com")
                })
                logger.info("Firebase initialized successfully")
            else:
                logger.warning("Firebase credentials file not found at %s", creds_path)
                FIREBASE_AVAILABLE = False
    except Exception as e:
        logger.warning("Failed to initialize Firebase: %s", e)
        FIREBASE_AVAILABLE = False


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15")) * 1024 * 1024

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "SmartMeds Backend is running!"})

# SECURITY CONFIGURATION

# CORS - Restrict to specific origins
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:19006').split(',')
CORS(app,
     resources={r"/*": {"origins": ALLOWED_ORIGINS}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"])

# Rate Limiting - Protect against abuse
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI", "memory://"),
)

# Security Headers Middleware
@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    if IS_PRODUCTION:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response


RPI_ENDPOINT = os.getenv("RPI_ENDPOINT", None)
API_KEY = os.getenv("SMARTMEDS_API_KEY", None)
REQUIRE_API_KEY = as_bool(os.getenv("REQUIRE_API_KEY"), default=IS_PRODUCTION)
ENABLE_SCHEDULER = as_bool(os.getenv("ENABLE_SCHEDULER"), default=not IS_PRODUCTION)

MEDICINE_LIST = [
    "Paracetamol",
    "Amoxicillin",
    "Azithromycin",
    "Cetirizine",
    "Ibuprofen",
    "Metformin",
    "Aspirin",
    "Atorvastatin",
    "Losartan",
    "Pantoprazole",
    "Ranitidine",
    "Dolo 650",
    "Crocin",
    "Cetrizine",
    "Disprin"
]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers – slots schema
# ─────────────────────────────────────────────────────────────────────────────

def _day_abbrev():
    """Return 3-letter lowercase day of week, e.g. 'mon'."""
    return datetime.now().strftime('%a').lower()

def _today_str():
    return datetime.now().strftime('%Y-%m-%d')

def _slot_is_today(slot_data):
    """Check whether a slot is scheduled for today based on dayOfWeek or scheduledDate."""
    day_of_week = slot_data.get('dayOfWeek')
    scheduled_date = slot_data.get('scheduledDate')
    today = _today_str()
    abbrev = _day_abbrev()

    if scheduled_date:
        return scheduled_date == today
    if day_of_week and isinstance(day_of_week, (list, dict)):
        days = day_of_week if isinstance(day_of_week, list) else list(day_of_week.values())
        return abbrev in [d.lower() for d in days]
    # If neither field set, treat as every day
    return True

def get_patient_medicines_from_slots(patient_uid):
    """Flatten all medicine names from slots/{uid} for NLP matching."""
    if not FIREBASE_AVAILABLE:
        return MEDICINE_LIST

    try:
        slots_ref = db.reference(f'slots/{patient_uid}')
        slots_data = slots_ref.get()
        medicine_names = []
        if slots_data:
            for slot_id, slot in slots_data.items():
                meds = slot.get('medicines', [])
                if isinstance(meds, list):
                    for m in meds:
                        # Strip dosage suffix like "Paracetamol 500mg" → "Paracetamol"
                        name = m.split()[0] if m else m
                        if name and name not in medicine_names:
                            medicine_names.append(name)
                        if m and m not in medicine_names:
                            medicine_names.append(m)
        if medicine_names:
            logger.info("Loaded %s medicine names from slots for patient %s", len(medicine_names), patient_uid)
            return medicine_names
        logger.warning("No slots found in Firebase, using default medicine list")
        return MEDICINE_LIST
    except Exception as e:
        logger.warning("Failed to fetch slots from Firebase: %s", e)
        return MEDICINE_LIST


def get_slots_for_today(patient_uid):
    """Return list of today's slot dicts from slots/{uid}."""
    if not FIREBASE_AVAILABLE:
        return []
    try:
        slots_ref = db.reference(f'slots/{patient_uid}')
        slots_data = slots_ref.get()
        if not slots_data:
            return []
        result = []
        for slot_id, slot in slots_data.items():
            if _slot_is_today(slot):
                result.append({'id': slot_id, **slot})
        result.sort(key=lambda s: s.get('scheduledTime', ''))
        return result
    except Exception as e:
        logger.warning("Error fetching today's slots: %s", e)
        return []


def _mark_slot_dispensed(patient_uid, slot_id, notes=None):
    """Set status=ready_to_dispense + dispense=True so Raspberry Pi picks it up."""
    slot_ref = db.reference(f'slots/{patient_uid}/{slot_id}')
    update = {
        'status': 'ready_to_dispense',
        'dispense': True,
        'requestedAt': datetime.now().isoformat(),
    }
    if notes:
        update['notes'] = notes
    slot_ref.update(update)
    # Decrement stock for each medicine in the slot
    _decrement_stock_for_slot(patient_uid, slot_id)



def _mark_slot_completed(patient_uid, slot_id):
    """Called after Raspberry Pi physically dispenses the medicines.
    Sets status=dispensed, dispense=False — resets slot for the next scheduled cycle."""
    slot_ref = db.reference(f'slots/{patient_uid}/{slot_id}')
    slot_ref.update({
        'status': 'dispensed',
        'dispense': False,
        'dispensedAt': datetime.now().isoformat(),
    })
    # Notify caregivers that patient took medicine
    _notify_caregivers_of_slot(patient_uid, slot_id, event='taken')


def _notify_caregivers_of_slot(patient_uid, slot_id, event='taken'):
    """Write an alert entry for every caregiver linked to this patient.
    event: 'taken' | 'missed'
    """
    try:
        slot_data = db.reference(f'slots/{patient_uid}/{slot_id}').get() or {}
        medicines = ', '.join(slot_data.get('medicines', [])) or 'medicine'
        time_slot = slot_data.get('timeSlot', slot_data.get('scheduledTime', ''))

        if event == 'taken':
            title = '✅ Medicine Taken'
            body = f"Patient took {time_slot} medicine: {medicines}"
            type_key = 'dose_taken'
        else:
            title = '⚠️ Missed Dose'
            body = f"Patient MISSED their {time_slot} medicine: {medicines}"
            type_key = 'dose_missed'

        # Find all caregivers for this patient
        caregivers_data = db.reference('caregivers').get() or {}
        for cg_uid, cg_info in caregivers_data.items():
            patients = cg_info.get('patients', {})
            if patient_uid in patients:
                _write_caregiver_alert(cg_uid, {
                    'title': title,
                    'body': body,
                    'type': type_key,
                    'patientUid': patient_uid,
                    'slotId': slot_id,
                    'timeSlot': time_slot,
                    'medicines': slot_data.get('medicines', []),
                    'createdAt': datetime.now().isoformat(),
                    'read': False,
                })
    except Exception as e:
        logger.warning('_notify_caregivers_of_slot error: %s', e)


def _write_caregiver_alert(caregiver_uid, alert_data):
    """Push an alert entry under /alerts/{caregiverUid} in Firebase."""
    alert_ref = db.reference(f'alerts/{caregiver_uid}')
    alert_ref.push(alert_data)
    logger.info('Alert written for caregiver %s: %s', caregiver_uid, alert_data.get('title'))



def _decrement_stock_for_slot(patient_uid, slot_id):
    """Decrement medicineStock quantities for all medicines in a slot."""
    try:
        slot_data = db.reference(f'slots/{patient_uid}/{slot_id}').get()
        if not slot_data:
            return
        meds_in_slot = slot_data.get('medicines', [])
        stock_data = db.reference(f'medicineStock/{patient_uid}').get()
        if not stock_data:
            return
        for med_entry in meds_in_slot:
            # Match by first word (name without dosage)
            med_name_key = med_entry.split()[0].lower() if med_entry else ''
            for stock_id, stock in stock_data.items():
                if stock.get('name', '').lower() == med_name_key:
                    new_qty = max(0, stock.get('quantity', 0) - 1)
                    is_low = new_qty <= stock.get('reorderLevel', 10)
                    db.reference(f'medicineStock/{patient_uid}/{stock_id}').update({
                        'quantity': new_qty,
                        'low_stock_alert': is_low
                    })
                    if is_low:
                        logger.warning("Low stock for %s (qty: %s)", stock.get('name'), new_qty)
                    break
    except Exception as e:
        logger.warning("Error decrementing stock: %s", e)


def require_api_key():
    """Enforce API key when configured and required."""
    if not REQUIRE_API_KEY:
        return None

    if not API_KEY:
        logger.error("REQUIRE_API_KEY is enabled but SMARTMEDS_API_KEY is not set")
        return jsonify({"error": "Server is not configured for authenticated requests"}), 503

    auth = request.headers.get("Authorization", "")
    header_key = None
    if auth.lower().startswith("bearer "):
        header_key = auth.split(None, 1)[1].strip()
    else:
        header_key = request.headers.get("X-API-KEY")

    if header_key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    return None


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Return generic 500 without leaking internals."""
    if isinstance(error, HTTPException):
        return error
    logger.exception("Unhandled server error: %s", error)
    if IS_PRODUCTION:
        return jsonify({"error": "Internal server error"}), 500
    return jsonify({"error": str(error)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "smartmeds-backend", "environment": APP_ENV}), 200


@app.route("/ready", methods=["GET"])
def ready():
    return jsonify({
        "status": "ready",
        "firebase": FIREBASE_AVAILABLE,
        "ffmpeg": FFMPEG_AVAILABLE,
        "audio_conversion": PYDUB_AVAILABLE or FFMPEG_AVAILABLE
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
# Audio / NLP
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/process_audio", methods=["POST"])
def process_audio():
    """Process audio and detect medicine/command using the slots schema."""

    patient_uid = request.args.get('patient_uid')
    if patient_uid and not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400

    # Build medicine name list from slots
    if patient_uid and FIREBASE_AVAILABLE:
        medicines = get_patient_medicines_from_slots(patient_uid)
    else:
        medicines = MEDICINE_LIST

    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']

    # Save incoming file to a temp location
    orig_suffix = os.path.splitext(audio_file.filename or "")[1] or ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=orig_suffix or ".tmp") as temp_in:
        audio_file.save(temp_in.name)
    temp_input_path = temp_in.name

    # Ensure we have a WAV file for the speech_recognition library
    wav_path = None
    try:
        if orig_suffix.lower().endswith('.wav'):
            wav_path = temp_input_path
        else:
            if PYDUB_AVAILABLE:
                try:
                    audio = AudioSegment.from_file(temp_input_path)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                        audio.export(temp_wav.name, format="wav")
                        wav_path = temp_wav.name
                except Exception as e:
                    if FFMPEG_AVAILABLE:
                        try:
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                                subprocess.run([
                                    "ffmpeg", "-i", temp_input_path,
                                    "-acodec", "pcm_s16le", "-ar", "16000",
                                    temp_wav.name, "-y"
                                ], check=True, capture_output=True, timeout=10)
                                wav_path = temp_wav.name
                        except Exception as e2:
                            logger.warning("Audio conversion failed with pydub and ffmpeg: %s | %s", e, e2)
                            return jsonify({"error": "Audio conversion failed"}), 400
                    else:
                        return jsonify({"error": "Audio conversion failed. Install ffmpeg to support mobile formats."}), 400
            elif FFMPEG_AVAILABLE:
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                        subprocess.run([
                            "ffmpeg", "-i", temp_input_path,
                            "-acodec", "pcm_s16le", "-ar", "16000",
                            temp_wav.name, "-y"
                        ], check=True, capture_output=True, timeout=10)
                        wav_path = temp_wav.name
                except Exception as e:
                    logger.warning("ffmpeg conversion failed: %s", e)
                    return jsonify({"error": "Audio conversion failed"}), 400
            else:
                return jsonify({"error": "Uploaded audio is not WAV and conversion support is unavailable."}), 400

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)

            from nlp_utils import detect_batch_command, extract_time_category, extract_medicine_number

            # ── BATCH / TIME COMMANDS ──────────────────────────────────────
            if detect_batch_command(text):
                time_category = extract_time_category(text)

                if time_category and patient_uid and FIREBASE_AVAILABLE:
                    # Auto-dispense all slots for this time category
                    dispensed = _dispense_slots_by_time(patient_uid, time_category)
                    return jsonify({
                        "text": text,
                        "batch_command": True,
                        "time_category": time_category,
                        "auto_dispensed": True,
                        "dispensed_count": len(dispensed),
                        "dispensed_slots": dispensed,
                        "status": "success"
                    })
                else:
                    return jsonify({
                        "text": text,
                        "batch_command": True,
                        "time_category": time_category,
                        "status": "success"
                    })

            # ── MEDICINE NUMBER REFERENCE ──────────────────────────────────
            medicine_number = extract_medicine_number(text)
            if medicine_number and patient_uid and FIREBASE_AVAILABLE:
                slot_info = _resolve_slot_by_number(medicine_number, patient_uid)
                if slot_info:
                    dosage = extract_dosage(text) or ''
                    return jsonify({
                        "text": text,
                        "slot_number": medicine_number,
                        "medicines": slot_info.get('medicines', []),
                        "dosage": dosage,
                        "notes": slot_info.get('notes', ''),
                        "scheduled_time": slot_info.get('scheduledTime', ''),
                        "status": "success"
                    })
                else:
                    return jsonify({
                        "text": text,
                        "slot_number": medicine_number,
                        "status": "not_found",
                        "message": f"Slot #{medicine_number} not found in your schedule"
                    })

            # ── MEDICINE NAME MATCH ────────────────────────────────────────
            medicine_name = find_closest_medicine(text, medicines)
            dosage = extract_dosage(text)
            if medicine_name:
                return jsonify({
                    "text": text,
                    "medicine_name": medicine_name,
                    "dosage": dosage,
                    "status": "success"
                })
            else:
                return jsonify({
                    "text": text,
                    "medicine_name": None,
                    "dosage": dosage,
                    "status": "not_found",
                    "message": "No matching medicine found"
                })

    except sr.UnknownValueError:
        return jsonify({"error": "Could not understand audio"}), 400
    except sr.RequestError:
        return jsonify({"error": "Speech recognition service unavailable"}), 503
    finally:
        for path in {temp_input_path, wav_path}:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    logger.warning("Failed to remove temp file: %s", path)


# ─────────────────────────────────────────────────────────────────────────────
# Slots – read
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/get_todays_slots", methods=["GET"])
def get_todays_slots():
    """Return all slots scheduled for today for a specific patient."""
    patient_uid = request.args.get('patient_uid')
    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    slots = get_slots_for_today(patient_uid)
    return jsonify({
        "slots": slots,
        "count": len(slots),
        "date": _today_str(),
        "status": "success"
    })


# Keep legacy endpoint for backward compat
@app.route("/get_todays_medicines", methods=["GET"])
def get_todays_medicines():
    """Legacy: proxies to get_todays_slots, flattened to a medicine list."""
    patient_uid = request.args.get('patient_uid')
    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    slots = get_slots_for_today(patient_uid)
    medicines = []
    for slot in slots:
        for med in slot.get('medicines', []):
            medicines.append({
                'name': med,
                'scheduledTime': slot.get('scheduledTime', ''),
                'slotNumber': slot.get('slotNumber'),
                'notes': slot.get('notes', ''),
                'status': slot.get('status', 'pending')
            })
    return jsonify({"medicines": medicines, "count": len(medicines), "status": "success"})


# ─────────────────────────────────────────────────────────────────────────────
# Slots – dispense helpers
# ─────────────────────────────────────────────────────────────────────────────

def _dispense_slots_by_time(patient_uid, time_category, notes=""):
    """Dispense all today's slots matching time_category.
    Matches by 'timeSlot' field first (set by new MedicineManager),
    falls back to hour-range for legacy slots.
    Returns list of dispensed slot summaries."""
    TIME_RANGES = {
        'morning':   (5, 12),
        'afternoon': (12, 17),
        'evening':   (17, 21),
        'night':     (21, 5),
    }
    slots = get_slots_for_today(patient_uid)
    dispensed = []
    for slot in slots:
        # Skip already dispensed / in-progress
        if slot.get('status') in ('dispensed', 'ready_to_dispense'):
            continue

        # Primary match: exact timeSlot field
        matched = slot.get('timeSlot', '').lower() == time_category

        # Fallback: match by hour range (legacy slots without timeSlot)
        if not matched:
            sched = slot.get('scheduledTime', '')
            try:
                hour = int(sched.split(':')[0])
                lo, hi = TIME_RANGES.get(time_category, (0, 24))
                matched = (lo <= hour < hi) if lo < hi else (hour >= lo or hour < hi)
            except Exception:
                matched = False

        if matched:
            slot_notes = notes or f"Voice command: dispense {time_category} medicines"
            _mark_slot_dispensed(patient_uid, slot['id'], notes=slot_notes)
            dispensed.append({
                'slot_id': slot['id'],
                'timeSlot': slot.get('timeSlot', time_category),
                'medicines': slot.get('medicines', []),
                'name': ', '.join(slot.get('medicines', [])),
                'scheduledTime': slot.get('scheduledTime', ''),
                'notes': slot.get('notes', '')
            })
    return dispensed


def _dispense_all_today_slots(patient_uid, notes=""):
    """Dispense ALL of today's pending slots (no time filter).
    Used for generic 'dispense' voice commands with no time category.
    Returns list of dispensed slot summaries."""
    slots = get_slots_for_today(patient_uid)
    dispensed = []
    for slot in slots:
        if slot.get('status') not in ('dispensed', 'ready_to_dispense'):
            slot_notes = notes or "Auto-dispensed via voice command: dispense all medicines"
            _mark_slot_dispensed(patient_uid, slot['id'], notes=slot_notes)
            dispensed.append({
                'slot_id': slot['id'],
                'slotNumber': slot.get('slotNumber'),
                'medicines': slot.get('medicines', []),
                'name': ', '.join(slot.get('medicines', [])),
                'scheduledTime': slot.get('scheduledTime', ''),
                'notes': slot.get('notes', '')
            })
    return dispensed



def _resolve_slot_by_number(slot_number, patient_uid):
    """Find slot data by slotNumber field."""
    try:
        slots_data = db.reference(f'slots/{patient_uid}').get()
        if not slots_data:
            return None
        for slot_id, slot in slots_data.items():
            if slot.get('slotNumber') == slot_number:
                return {'id': slot_id, **slot}
        return None
    except Exception as e:
        logger.warning("Error resolving slot number: %s", e)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Slots – dispense endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/send_instruction", methods=["POST"])
def send_instruction():
    """Mark a slot as ready_to_dispense in Firebase.

    Accepts:
      medicine_name   – matched against slot.medicines[]
      slot_number     – direct slot number
      patient_uid     – required
      dosage          – optional
      notes           – optional free-text notes written to DB
      action          – 'dispense' (default)
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error

    data = request.get_json() or {}
    medicine_name = data.get("medicine_name")
    slot_number = data.get("medicine_number") or data.get("slot_number")
    patient_uid = data.get("patient_uid")
    dosage = data.get("dosage", "")
    notes = data.get("notes", "")

    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    try:
        slots_data = db.reference(f'slots/{patient_uid}').get()
        if not slots_data:
            return jsonify({"error": f"No slots found for patient {patient_uid}"}), 404

        target_slot = None
        target_slot_id = None

        # Priority 1: by slot number
        if slot_number is not None:
            for sid, slot in slots_data.items():
                if slot.get('slotNumber') == int(slot_number):
                    target_slot = slot
                    target_slot_id = sid
                    break

        # Priority 2: by medicine name in slot.medicines[]
        if not target_slot_id and medicine_name:
            med_lower = medicine_name.lower()
            for sid, slot in slots_data.items():
                for m in slot.get('medicines', []):
                    if med_lower in m.lower():
                        target_slot = slot
                        target_slot_id = sid
                        break
                if target_slot_id:
                    break

        if not target_slot_id:
            return jsonify({"error": f"No matching slot found for patient"}), 404

        # Build notes string (merge existing notes + new notes/dosage info)
        existing_notes = target_slot.get('notes', '')
        full_notes = existing_notes
        if dosage:
            full_notes = f"{full_notes} | Dosage: {dosage}".strip(' |')
        if notes:
            full_notes = f"{full_notes} | {notes}".strip(' |')

        _mark_slot_dispensed(patient_uid, target_slot_id, notes=full_notes if full_notes else None)

        logger.info(
            "Slot %s (slotNumber %s) → ready_to_dispense for patient %s",
            target_slot_id, target_slot.get('slotNumber'), patient_uid
        )

        return jsonify({
            "status": "success",
            "message": f"Slot {target_slot.get('slotNumber')} marked ready to dispense",
            "slot_id": target_slot_id,
            "slot_number": target_slot.get('slotNumber'),
            "medicines": target_slot.get('medicines', []),
            "notes": full_notes,
            "patient_uid": patient_uid
        })

    except Exception as e:
        logger.error("Error updating slot status: %s", e)
        return jsonify({"error": "Failed to update slot status"}), 500


@app.route("/dispense_by_time", methods=["POST"])
def dispense_by_time():
    """Voice-triggered: mark all today's slots (optionally filtered by time category) as ready_to_dispense.

    Body: { "time": "morning" (optional), "patient_uid": "abc123", "notes": "optional" }
    If 'time' is omitted, ALL of today's pending slots are dispensed.
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error

    data = request.get_json() or {}
    time_category = data.get("time", "").lower().strip()
    patient_uid = data.get("patient_uid")
    notes = data.get("notes", "")

    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    if time_category and time_category not in ('morning', 'afternoon', 'evening', 'night'):
        return jsonify({"error": "time must be morning, afternoon, evening, or night"}), 400
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    if time_category:
        dispensed = _dispense_slots_by_time(patient_uid, time_category, notes=notes)
        label = time_category
    else:
        # No time category — dispense ALL of today's pending slots
        dispensed = _dispense_all_today_slots(patient_uid, notes=notes)
        label = "all"

    if not dispensed:
        return jsonify({
            "status": "success",
            "message": f"No pending {label} slots found or auto-dispense is off",
            "count": 0,
            "medicines": []
        })

    logger.info("Dispensed %s %s slots for patient %s", len(dispensed), label, patient_uid)
    return jsonify({
        "status": "success",
        "message": f"Marked {len(dispensed)} slot(s) ready to dispense",
        "slots": dispensed,
        "count": len(dispensed),
        "medicines": dispensed
    })


@app.route("/confirm_dispensed", methods=["POST"])
def confirm_dispensed():
    """Called by Raspberry Pi AFTER it physically dispenses the medicines for a slot.
    Sets status=dispensed + dispense=False — resets slot for the next scheduled cycle.

    Body: { "patient_uid": "...", "slot_id": "..." }
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error

    data = request.get_json() or {}
    patient_uid = data.get("patient_uid")
    slot_id = data.get("slot_id")

    if not patient_uid or not slot_id:
        return jsonify({"error": "patient_uid and slot_id are required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    try:
        _mark_slot_completed(patient_uid, slot_id)
        logger.info("Slot %s confirmed dispensed for patient %s", slot_id, patient_uid)
        return jsonify({
            "status": "success",
            "message": f"Slot {slot_id} marked as dispensed",
            "slot_id": slot_id,
            "patient_uid": patient_uid
        })
    except Exception as e:
        logger.error("confirm_dispensed error: %s", e)
        return jsonify({"error": "Failed to confirm dispensed"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Device endpoints (Raspberry Pi telemetry)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/check_missed_doses", methods=["POST"])
def check_missed_doses():
    """Check all patients for overdue pending slots and mark them as missed.
    Writes caregiver alerts for any missed dose.
    Call this from Raspberry Pi on a schedule (e.g. every 30 min).

    Body: { "patient_uid": "..." }  OR  no body to check ALL patients.
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    data = request.get_json() or {}
    patient_uid = data.get("patient_uid")

    try:
        now = datetime.now()
        now_minutes = now.hour * 60 + now.minute
        missed_count = 0

        patients_to_check = [patient_uid] if patient_uid else []
        if not patients_to_check:
            # Load all patients from all caregivers
            caregivers_data = db.reference('caregivers').get() or {}
            seen = set()
            for cg_info in caregivers_data.values():
                for pid in (cg_info.get('patients') or {}).keys():
                    if pid not in seen:
                        patients_to_check.append(pid)
                        seen.add(pid)

        for pid in patients_to_check:
            slots = get_slots_for_today(pid)
            for slot in slots:
                if slot.get('status') != 'pending':
                    continue
                sched = slot.get('scheduledTime', '')
                try:
                    h, m = map(int, sched.split(':'))
                    slot_minutes = h * 60 + m
                except Exception:
                    continue
                # Mark missed if more than 30 minutes past the scheduled time
                if now_minutes - slot_minutes > 30:
                    db.reference(f'slots/{pid}/{slot["id"]}').update({
                        'status': 'missed',
                        'missedAt': datetime.now().isoformat(),
                    })
                    _notify_caregivers_of_slot(pid, slot['id'], event='missed')
                    missed_count += 1
                    logger.info("Slot %s marked missed for patient %s", slot['id'], pid)

        return jsonify({"status": "success", "missed": missed_count})
    except Exception as e:
        logger.error("check_missed_doses error: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/device_status/<device_id>", methods=["GET"])
def device_status(device_id):
    """Return telemetry + alerts for a given device id."""
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    try:
        device_data = db.reference(f'devices/{device_id}').get()
        if not device_data:
            return jsonify({"error": f"Device {device_id} not found"}), 404
        return jsonify({"status": "success", "device_id": device_id, "data": device_data})
    except Exception as e:
        logger.error("Error fetching device status: %s", e)
        return jsonify({"error": "Failed to fetch device status"}), 500


@app.route("/device_alert/<device_id>", methods=["POST"])
def device_alert(device_id):
    """Raspberry Pi posts its telemetry/alerts here.

    Body can contain any subset of the device schema:
    { "telemetry": {...}, "alerts": {...}, "system_halt": false }
    """
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503

    payload = request.get_json() or {}
    if not payload:
        return jsonify({"error": "Empty payload"}), 400

    try:
        device_ref = db.reference(f'devices/{device_id}')
        existing = device_ref.get() or {}

        update = {}
        if 'telemetry' in payload:
            telem = payload['telemetry']
            telem['reported_at'] = datetime.now().isoformat()
            update['telemetry'] = {**existing.get('telemetry', {}), **telem}
        if 'alerts' in payload:
            update['alerts'] = {**existing.get('alerts', {}), **payload['alerts']}
        if 'system_halt' in payload:
            update['system_halt'] = payload['system_halt']

        device_ref.update(update)
        logger.info("Device %s telemetry updated", device_id)
        return jsonify({"status": "success", "device_id": device_id})
    except Exception as e:
        logger.error("Error updating device alert: %s", e)
        return jsonify({"error": "Failed to update device"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler startup
# ─────────────────────────────────────────────────────────────────────────────

if ENABLE_SCHEDULER:
    try:
        from scheduler import start_scheduler
        start_scheduler()
    except ImportError:
        logger.warning("Scheduler not found or failed to import")
else:
    logger.info("Scheduler startup is disabled")

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "5000")),
        debug=as_bool(os.getenv("FLASK_DEBUG"), default=not IS_PRODUCTION),
        use_reloader=False,
    )
