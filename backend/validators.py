"""
Input validation and sanitization for SmartMeds backend API
Prevents injection attacks and ensures data integrity
"""
import re
from typing import Optional, Dict, Any
from functools import wraps
from flask import request, jsonify

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_medicine_name(name: str) -> bool:
    """Validate medicine name - alphanumeric + spaces/hyphens only"""
    if not name or len(name) > 100:
        return False
    pattern = r'^[a-zA-Z0-9\s\-]+$'
    return bool(re.match(pattern, name))

def validate_dosage(dosage: str) -> bool:
    """Validate dosage format"""
    if not dosage or len(dosage) > 50:
        return False
    # Allow dosages like "500mg", "2 tablets", "5ml" etc
    pattern = r'^[0-9]+\s*(mg|ml|g|mcg|tablets?|capsules?|units?)$'
    return bool(re.match(pattern, dosage.lower()))

def validate_time(time_str: str) -> bool:
    """Validate time in HH:MM format"""
    pattern = r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
    return bool(re.match(pattern, time_str))

def validate_uid(uid: str) -> bool:
    """Validate Firebase UID format"""
    if not uid or len(uid) > 128:
        return False
    # Firebase UIDs are alphanumeric
    pattern = r'^[a-zA-Z0-9]+$'
    return bool(re.match(pattern, uid))

def sanitize_string(text: str, max_length: int = 1000) -> str:
    """Sanitize string input - remove dangerous characters"""
    if not text:
        return ""
    # Remove HTML tags and suspicious characters
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'[<>"\'&]', '', text)
    return text[:max_length].strip()

def validate_request_data(required_fields: Dict[str, str]):

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check if request has data
            if request.method == 'POST':
                data = request.get_json()
                if not data:
                    return jsonify({"error": "No data provided"}), 400
            elif request.method == 'GET':
                data = request.args.to_dict()
            else:
                data = {}
            
            # Validate required fields
            for field, field_type in required_fields.items():
                value = data.get(field)
                
                if value is None:
                    return jsonify({"error": f"Missing required field: {field}"}), 400
                
                # Type-specific validation
                if field_type == 'email':
                    if not validate_email(value):
                        return jsonify({"error": f"Invalid email format: {field}"}), 400
                elif field_type == 'uid':
                    if not validate_uid(value):
                        return jsonify({"error": f"Invalid UID format: {field}"}), 400
                elif field_type == 'medicine':
                    if not validate_medicine_name(value):
                        return jsonify({"error": f"Invalid medicine name: {field}"}), 400
                elif field_type == 'dosage':
                    if not validate_dosage(value):
                        return jsonify({"error": f"Invalid dosage format: {field}"}), 400
                elif field_type == 'time':
                    if not validate_time(value):
                        return jsonify({"error": f"Invalid time format: {field} (expected HH:MM)"}), 400
                elif field_type == 'string':
                    if not isinstance(value, str) or len(value) > 1000:
                        return jsonify({"error": f"Invalid string: {field}"}), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
    