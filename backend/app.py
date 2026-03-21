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

# ============================================
# END SECURITY CONFIGURATION
# ============================================


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

def get_patient_medicines(patient_uid):
    """Fetch medicines from Firestore for a specific patient."""
    if not FIREBASE_AVAILABLE:
        return MEDICINE_LIST
    
    try:
        medicines = []
        medicines_ref = firestore.client().collection("users").document(patient_uid).collection("medicines")
        docs = medicines_ref.stream()
        
        for doc in docs:
            medicine_data = doc.to_dict()
            if medicine_data and 'name' in medicine_data:
                medicines.append(medicine_data['name'])
        
        if medicines:
            logger.info("Loaded %s medicines from Firebase for patient %s", len(medicines), patient_uid)
            return medicines
        else:
            logger.warning("No medicines found in Firebase, using default list")
            return MEDICINE_LIST
    except Exception as e:
        logger.warning("Failed to fetch medicines from Firebase: %s", e)
        return MEDICINE_LIST


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

# find_closest_medicine and extract_dosage are provided by backend/nlp_utils.py


@app.route("/process_audio", methods=["POST"])
def process_audio():
    """Process audio and detect medicine. Optionally use patient-specific medicines from Firebase."""
    
    # Get patient UID from query params (optional)
    patient_uid = request.args.get('patient_uid')
    if patient_uid and not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    
    # Get medicines list (patient-specific if UID provided, otherwise default)
    if patient_uid and FIREBASE_AVAILABLE:
        medicines = get_patient_medicines(patient_uid)
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
            # Try to convert with pydub if available
            if PYDUB_AVAILABLE:
                try:
                    audio = AudioSegment.from_file(temp_input_path)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                        audio.export(temp_wav.name, format="wav")
                        wav_path = temp_wav.name
                except Exception as e:
                    # conversion failed, try ffmpeg next
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
                # Try ffmpeg via subprocess if pydub not available
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
            
            # Check if it's a batch command (e.g., "dispense today's medicines" or "morning medicine")
            from nlp_utils import detect_batch_command, extract_time_category, extract_medicine_number, resolve_medicine_number
            if detect_batch_command(text):
                # Check if it's a time-based command
                time_category = extract_time_category(text)
                if time_category:
                    return jsonify({
                        "text": text,
                        "batch_command": True,
                        "time_category": time_category,
                        "status": "success"
                    })
                else:
                    return jsonify({
                        "text": text,
                        "batch_command": True,
                        "status": "success"
                    })
            
            # Check if it's a medicine number (e.g., "medicine 3", "number 5")
            medicine_number = extract_medicine_number(text)
            if medicine_number and patient_uid and FIREBASE_AVAILABLE:
                # Resolve medicine number to actual medicine
                medicine_info = resolve_medicine_number(medicine_number, patient_uid)
                if medicine_info:
                    dosage = extract_dosage(text) or medicine_info.get('dosage', '')
                    return jsonify({
                        "text": text,
                        "medicine_name": medicine_info['name'],
                        "medicine_number": medicine_number,
                        "dosage": dosage,
                        "slot": medicine_info.get('slot'),
                        "status": "success"
                    })
                else:
                    return jsonify({
                        "text": text,
                        "medicine_number": medicine_number,
                        "medicine_name": None,
                        "status": "not_found",
                        "message": f"Medicine #{medicine_number} not found in your list"
                    })
            
            # Try to find medicine by name (existing logic)
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


@app.route("/get_todays_medicines", methods=["GET"])
def get_todays_medicines():
    """Fetch all medicines scheduled for today for a specific patient."""
    patient_uid = request.args.get('patient_uid')
    
    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503
    
    try:
        from datetime import datetime
        current_hour = int(datetime.now().strftime("%H"))
        
        medicines = []
        medicines_ref = db.reference(f'medicines/{patient_uid}')
        medicines_data = medicines_ref.get()
        
        if medicines_data:
            for med_id, medicine_data in medicines_data.items():
                scheduled_time = medicine_data.get('scheduledTime', '')
                
                # If medicine has a scheduled time for today, include it
                if scheduled_time:
                    try:
                        scheduled_hour = int(scheduled_time.split(':')[0])
                        # Include medicines scheduled for current hour or earlier today
                        if scheduled_hour <= current_hour:
                            medicines.append({
                                'name': medicine_data.get('name'),
                                'dosage': medicine_data.get('dosage', 'As prescribed'),
                                'scheduledTime': scheduled_time
                            })
                    except:
                        pass
        
        return jsonify({
            "medicines": medicines,
            "count": len(medicines),
            "status": "success"
        })
    except Exception as e:
        logger.warning("Failed to fetch today's medicines: %s", e)
        return jsonify({"error": "Failed to fetch medicines"}), 500


@app.route("/send_instruction", methods=["POST"])
def send_instruction():
    """Update medicine status in Firebase for Raspberry Pi to monitor and dispense.
    
    Expected JSON body: {
        "medicine_name": "Paracetamol",  # OR
        "medicine_number": 3,             # Medicine number (1-8)
        "patient_uid": "abc123",
        "dosage": "500 mg", 
        "action": "dispense"
    }
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error

    data = request.get_json() or {}
    medicine_name = data.get("medicine_name")
    medicine_number = data.get("medicine_number")
    patient_uid = data.get("patient_uid")
    dosage = data.get("dosage")
    action = data.get("action", "dispense")
    
    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400

    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503
    
    # If medicine_number is provided, resolve it to medicine_name
    if medicine_number and not medicine_name:
        from nlp_utils import resolve_medicine_number
        medicine_info = resolve_medicine_number(medicine_number, patient_uid)
        if medicine_info:
            medicine_name = medicine_info['name']
            logger.info("Resolved medicine #%s to %s", medicine_number, medicine_name)
        else:
            return jsonify({"error": f"Medicine #{medicine_number} not found for patient"}), 404

    if not medicine_name:
        return jsonify({"error": "medicine_name or medicine_number is required"}), 400

    try:
        # Find medicine in Firebase by name
        medicines_ref = db.reference(f'medicines/{patient_uid}')
        medicines_data = medicines_ref.get()
        
        if not medicines_data:
            return jsonify({"error": f"No medicines found for patient {patient_uid}"}), 404
        
        medicine_id = None
        medicine_slot = None
        medicine_num = None
        for med_id, med_data in medicines_data.items():
            if med_data.get('name') == medicine_name:
                medicine_id = med_id
                medicine_slot = med_data.get('slot')
                medicine_num = med_data.get('medicineNumber') or med_data.get('slot')
                break
        
        if not medicine_id:
            return jsonify({"error": f"Medicine '{medicine_name}' not found for patient"}), 404
        
        # Update status to ready_to_dispense and mark as dispensed
        from datetime import datetime
        medicine_ref = db.reference(f'medicines/{patient_uid}/{medicine_id}')
        medicine_ref.update({
            'status': 'ready_to_dispense',
            'requestedAt': datetime.now().isoformat(),
            'dispensedAt': datetime.now().isoformat()  # Add this to update the counter
        })
        
        logger.info(
            "Updated %s (slot %s, #%s) to ready_to_dispense for patient %s",
            medicine_name, medicine_slot, medicine_num, patient_uid
        )
        
        return jsonify({
            "status": "success",
            "message": f"{medicine_name} marked ready to dispense",
            "medicine_id": medicine_id,
            "medicine_number": medicine_num,
            "slot": medicine_slot,
            "patient_uid": patient_uid
        })
    
    except Exception as e:
        logger.error("Error updating medicine status: %s", e)
        return jsonify({"error": "Failed to update medicine status"}), 500


@app.route("/dispense_by_time", methods=["POST"])
def dispense_by_time():
    """Mark all medicines for a specific time category as ready to dispense.
    
    Expected JSON body: {
        "time": "morning",  # morning, afternoon, evening, night
        "patient_uid": "abc123"
    }
    """
    auth_error = require_api_key()
    if auth_error:
        return auth_error

    data = request.get_json() or {}
    time_category = data.get("time")
    patient_uid = data.get("patient_uid")
    
    if not time_category:
        return jsonify({"error": "time is required (morning/afternoon/evening/night)"}), 400
    
    if not patient_uid:
        return jsonify({"error": "patient_uid is required"}), 400
    if not validate_uid(patient_uid):
        return jsonify({"error": "invalid patient_uid"}), 400
    
    if time_category not in ['morning', 'afternoon', 'evening', 'night']:
        return jsonify({"error": "time must be morning, afternoon, evening, or night"}), 400
    
    if not FIREBASE_AVAILABLE:
        return jsonify({"error": "Firebase not available"}), 503
    
    try:
        from datetime import datetime
        
        # Find all medicines for this time category
        medicines_ref = db.reference(f'medicines/{patient_uid}')
        medicines_data = medicines_ref.get()
        
        if not medicines_data:
            return jsonify({"error": f"No medicines found for patient {patient_uid}"}), 404
        
        updated_count = 0
        updated_medicines = []
        
        for med_id, med_data in medicines_data.items():
            if med_data.get('time') == time_category and med_data.get('dispense') == True:
                # Update status and mark as dispensed
                medicine_ref = db.reference(f'medicines/{patient_uid}/{med_id}')
                medicine_ref.update({
                    'status': 'ready_to_dispense',
                    'requestedAt': datetime.now().isoformat(),
                    'dispensedAt': datetime.now().isoformat()
                })
                
                updated_count += 1
                updated_medicines.append({
                    'name': med_data.get('name'),
                    'slot': med_data.get('slot'),
                    'dosage': med_data.get('dosage', '')
                })
        
        if updated_count == 0:
            return jsonify({
                "status": "success",
                "message": f"No {time_category} medicines with auto-dispense enabled",
                "count": 0,
                "medicines": []
            })
        
        logger.info(
            "Marked %s %s medicines ready to dispense for patient %s",
            updated_count, time_category, patient_uid
        )
        
        return jsonify({
            "status": "success",
            "message": f"Marked {updated_count} {time_category} medicine(s) ready to dispense",
            "medicines": updated_medicines,
            "count": updated_count
        })
    
    except Exception as e:
        logger.error("Error updating medicines by time: %s", e)
        return jsonify({"error": "Failed to update medicines"}), 500


# Import and start scheduler
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
