from flask import Flask, request, jsonify
from flask_cors import CORS
import speech_recognition as sr
import tempfile
import difflib
import re
import requests

app = Flask(__name__)
CORS(app)

# Configure your Raspberry Pi endpoint here. Example: http://raspberrypi.local:8000/execute
# If you don't have a Pi endpoint yet, leave as None and the server will simply log the instruction.
RPI_ENDPOINT = None

#  Predefined list of medicine names (you can expand this)
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

def find_closest_medicine(recognized_text):
    """
    Find the closest matching medicine from the list using fuzzy match.
    """
    recognized_text = recognized_text.lower()
    matches = difflib.get_close_matches(recognized_text, [m.lower() for m in MEDICINE_LIST], n=1, cutoff=0.6)
    if matches:
        # return the proper case name from MEDICINE_LIST
        for med in MEDICINE_LIST:
            if med.lower() == matches[0]:
                return med
    return None


def extract_dosage(recognized_text):
    """
    Very simple dosage extractor: looks for patterns like '500 mg', '2 tablets', 'one pill', or numbers.
    This is intentionally lightweight — you can replace with an NLP service later.
    """
    text = recognized_text.lower()

    # common word-number mapping
    words_to_nums = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    }

    # look for patterns like '500 mg' or '10 ml' or '2 tablets'
    m = re.search(r"(\d+\s*(mg|ml|g|tablets|tablet|pills|pill)?)", text)
    if m:
        return m.group(0).strip()

    # look for 'one pill', 'two tablets' etc
    m2 = re.search(r"(one|two|three|four|five|six|seven|eight|nine|ten)\s*(pills|pill|tablets|tablet)?", text)
    if m2:
        word = m2.group(1)
        unit = m2.group(2) or ''
        return f"{words_to_nums.get(word, word)} {unit}".strip()

    return None


@app.route("/process_audio", methods=["POST"])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        audio_file.save(temp_audio.name)

        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_audio.name) as source:
            audio_data = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio_data)
                medicine_name = find_closest_medicine(text)
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
            except sr.RequestError as e:
                return jsonify({"error": f"Speech recognition error: {e}"}), 500


@app.route("/send_instruction", methods=["POST"])
def send_instruction():
    """Receive an instruction (medicine_name, dosage, action) and forward to Raspberry Pi.

    Expected JSON body: {"medicine_name": "Paracetamol", "dosage": "500 mg", "action": "dispense"}
    """
    data = request.get_json() or {}
    medicine_name = data.get("medicine_name")
    dosage = data.get("dosage")
    action = data.get("action", "dispense")

    if not medicine_name:
        return jsonify({"error": "medicine_name is required"}), 400

    payload = {
        "medicine_name": medicine_name,
        "dosage": dosage,
        "action": action
    }

    # If an RPI endpoint is configured, forward the payload
    if RPI_ENDPOINT:
        try:
            resp = requests.post(RPI_ENDPOINT, json=payload, timeout=5)
            resp.raise_for_status()
            return jsonify({"status": "forwarded", "rpi_status_code": resp.status_code, "rpi_response": resp.text})
        except Exception as e:
            return jsonify({"error": f"Failed to forward to Raspberry Pi: {e}", "payload": payload}), 502

    # Otherwise, just log and return success for demo purposes
    print("[SIMULATION] Instruction to Raspberry Pi:", payload)
    return jsonify({"status": "simulated", "payload": payload})


if __name__ == "__main__":
    app.run(debug=True)
