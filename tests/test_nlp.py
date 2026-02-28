import pytest

from backend import nlp_utils


@pytest.mark.parametrize(
    "text,expected_med",
    [
        ("paracetamol", "Paracetamol"),
        ("i need amoxicillin", "Amoxicillin"),
        ("give me ibuprofen", "Ibuprofen"),
        ("dolo 650 please", "Dolo 650"),
    ],
)
def test_find_closest_medicine(text, expected_med):
    assert nlp_utils.find_closest_medicine(text) == expected_med


@pytest.mark.parametrize(
    "text,expected",
    [
        ("500 mg paracetamol", "500 mg"),
        ("two tablets of amoxicillin", "2 tablets"),
        ("one pill of ibuprofen", "1 pill"),
        ("give me 10 ml", "10 ml"),
    ],
)
def test_extract_dosage(text, expected):
    result = nlp_utils.extract_dosage(text)
    assert result is not None
    # allow slight variations (e.g., '2 tablets' vs '2 tablet')
    assert expected.split()[0] == result.split()[0]


import pytest


@pytest.mark.skipif(not getattr(nlp_utils, '_SPACY_LOADED', False), reason="spaCy model not installed")
def test_matcher_patterns():
    # These should be matched by spaCy Matcher when model is available
    assert nlp_utils.find_closest_medicine("I need Paracetamol 500 mg") == "Paracetamol"
    assert nlp_utils.find_closest_medicine("dolo 650") == "Dolo 650"
    # dosage matcher
    d = nlp_utils.extract_dosage("Please give me 500 mg of paracetamol")
    assert d is not None and "500" in d
