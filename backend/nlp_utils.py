
from typing import Optional
import difflib
import re

def detect_batch_command(text):
    """Detect if the command is asking for all/today's medicines or time-based medicines."""
    text_lower = text.lower()
    batch_keywords = [
        "today's medicines",
        "today's medication",
        "todays medicines",
        "todays medication",
        "all medicines",
        "all medications",
        "all my medicines",
        "dispense all",
        "give me all",
        # Time-based keywords
        "morning medicine",
        "morning medication",
        "morning meds",
        "afternoon medicine",
        "afternoon medication",
        "afternoon meds",
        "evening medicine",
        "evening medication",
        "evening meds",
        "night medicine",
        "night medication",
        "night meds"
    ]
    
    for keyword in batch_keywords:
        if keyword in text_lower:
            return True
    return False


def extract_time_category(text):
    """Extract time category (morning/afternoon/evening/night) from voice command.
    
    Args:
        text: The speech-to-text output
    
    Returns:
        The time category ('morning', 'afternoon', 'evening', 'night') or None
    """
    if not text:
        return None
    
    text_lower = text.lower()
    
    # Check for time-based keywords
    if any(word in text_lower for word in ["morning", "morn"]):
        return "morning"
    elif any(word in text_lower for word in ["afternoon", "noon"]):
        return "afternoon"
    elif any(word in text_lower for word in ["evening", "eve"]):
        return "evening"
    elif any(word in text_lower for word in ["night", "nite"]):
        return "night"
    
    return None



try:
    import spacy
    _SPACY_LOADED = False
    try:
        
        nlp = spacy.load("en_core_web_sm")
        _SPACY_LOADED = True
    except Exception:
      
        nlp = None
        _SPACY_LOADED = False
except Exception:
    spacy = None
    nlp = None
    _SPACY_LOADED = False



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


def find_closest_medicine(recognized_text: str, medicine_list: list = None) -> Optional[str]:
    """Find the closest medicine match in the recognized text.
    
    Args:
        recognized_text: The speech-to-text output
        medicine_list: Custom list of medicines (defaults to MEDICINE_LIST if None)
    
    Returns:
        The matched medicine name or None
    """
    if medicine_list is None:
        medicine_list = MEDICINE_LIST
    
    if not recognized_text:
        return None
 
    if _SPACY_LOADED and nlp is not None:
        doc = nlp(recognized_text)
  
        try:
            from spacy.matcher import Matcher
            matcher = Matcher(nlp.vocab)
            
            med_map = {}
            for med in medicine_list:
                key = f"MED_{med.upper().replace(' ', '_') }"
                tokens = med.lower().split()
                pattern = [{"LOWER": t} for t in tokens]
                matcher.add(key, [pattern])
                med_map[key] = med

            matches = matcher(doc)
            if matches:
               
                match_id, start, end = matches[0]
                key = nlp.vocab.strings[match_id]
                return med_map.get(key)
        except Exception:
            
            pass

    recognized_text = recognized_text.lower()
    matches = difflib.get_close_matches(recognized_text, [m.lower() for m in medicine_list], n=1, cutoff=0.6)
    if matches:
        for med in medicine_list:
            if med.lower() == matches[0]:
                return med
    return None


def extract_dosage(recognized_text: str) -> Optional[str]:
   
    if not recognized_text:
        return None
    text = recognized_text.lower()

   
    if _SPACY_LOADED and nlp:
        try:
            from spacy.matcher import Matcher
            doc = nlp(text)
            matcher = Matcher(nlp.vocab)
            # numeric + unit pattern:  '500 mg', '10 ml'
            matcher.add("NUM_UNIT", [[{"LIKE_NUM": True}, {"LOWER": {"IN": ["mg", "ml", "g"]}}]])
            # number + unit words: '2 tablets', '1 pill'
            matcher.add("NUM_UNIT_WORD", [[{"LIKE_NUM": True}, {"LOWER": {"IN": ["tablet", "tablets", "pill", "pills"]}}]])
            # word-number + unit: 'one pill'
            matcher.add("WORDNUM_UNIT", [[{"LOWER": {"IN": ["one","two","three","four","five","six","seven","eight","nine","ten"]}}, {"LOWER": {"IN": ["tablet","tablets","pill","pills"]}}]])

            matches = matcher(doc)
            if matches:
               
                match_id, start, end = matches[0]
                return doc[start:end].text

           
            for ent in doc.ents:
                if ent.label_.lower() in ("quantity", "measure"):
                    return ent.text
        except Exception:
            
            pass

   
    m = re.search(r"(\d+\s*(mg|ml|g|tablets|tablet|pills|pill)?)", text)
    if m:
        return m.group(0).strip()

    
    words_to_nums = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    }
    m2 = re.search(r"(one|two|three|four|five|six|seven|eight|nine|ten)\s*(pills|pill|tablets|tablet)?", text)
    if m2:
        word = m2.group(1)
        unit = m2.group(2) or ''
        return f"{words_to_nums.get(word, word)} {unit}".strip()

    return None


def extract_medicine_number(recognized_text: str) -> Optional[int]:
    """Extract medicine number from voice command.
    
    Supports patterns like:
    - "medicine 3"
    - "number 5"
    - "medicine number 2"
    - "med 4"
    
    Args:
        recognized_text: The speech-to-text output
    
    Returns:
        The medicine number (1-8) or None if not found
    """
    if not recognized_text:
        return None
    
    text_lower = recognized_text.lower()
    
    # Pattern 1: "medicine number X" or "medicine X"
    match = re.search(r'\b(?:medicine|med|medication)\s*(?:number|no|num)?\s*([1-8])\b', text_lower)
    if match:
        return int(match.group(1))
    
    # Pattern 2: "number X"
    match = re.search(r'\b(?:number|no|num)\s*([1-8])\b', text_lower)
    if match:
        return int(match.group(1))
    
  
    # Only match if it's clearly a medicine reference
    if any(word in text_lower for word in ['medicine', 'med', 'medication', 'dispense', 'give']):
        match = re.search(r'\b([1-8])\b', text_lower)
        if match:
            return int(match.group(1))
    
    return None


def resolve_medicine_number(medicine_number: int, patient_uid: str):
    """Resolve a medicine number to the actual medicine details from Firebase.
    
    Args:
        medicine_number: The medicine number (1-8)
        patient_uid: The patient's UID
    
    Returns:
        Dictionary with medicine details (id, name, dosage, slot) or None if not found
    """
    try:
        # Import Firebase here to avoid circular dependencies
        from firebase_admin import db
        
        if not patient_uid:
            return None
        
        # Get all medicines for this patient
        medicines_ref = db.reference(f'medicines/{patient_uid}')
        medicines_data = medicines_ref.get()
        
        if not medicines_data:
            return None
        
        # Find medicine with matching number (or slot as fallback)
        for med_id, med_data in medicines_data.items():
            # Check medicineNumber first, fall back to slot
            med_num = med_data.get('medicineNumber') or med_data.get('slot')
            if med_num == medicine_number:
                return {
                    'id': med_id,
                    'name': med_data.get('name'),
                    'dosage': med_data.get('dosage', ''),
                    'slot': med_data.get('slot'),
                    'medicineNumber': med_num
                }
        
        return None
        
    except Exception as e:
        print(f"Error resolving medicine number: {e}")
        return None


__all__ = [
    "find_closest_medicine", 
    "extract_dosage", 
    "extract_time_category", 
    "detect_batch_command", 
    "extract_medicine_number",
    "resolve_medicine_number",
    "MEDICINE_LIST"
]
