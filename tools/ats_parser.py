import sys
import json
import re
from collections import Counter
import math

def tokenize(text):
    # Pure standard library tokenizer (fast, zero dependencies)
    text = text.lower()
    # Remove punctuation
    text = re.sub(r'[^\w\s]', ' ', text)
    tokens = text.split()
    # Basic stopword list to prevent noise
    stopwords = {'and', 'the', 'is', 'in', 'to', 'with', 'for', 'of', 'a', 'an', 'on', 'at', 'by', 'this', 'that', 'are', 'as', 'be', 'or', 'it'}
    return [t for t in tokens if t not in stopwords and len(t) > 2]

def calculate_ats_score(resume_text, jd_text):
    resume_tokens = tokenize(resume_text)
    jd_tokens = tokenize(jd_text)
    
    resume_counts = Counter(resume_tokens)
    jd_counts = Counter(jd_tokens)
    
    # Extract unique keywords expected by the JD
    jd_keywords = set(jd_tokens)
    
    # Find matching and missing keywords
    matched_keywords = [kw for kw in jd_keywords if kw in resume_counts]
    missing_keywords = [kw for kw in jd_keywords if kw not in resume_counts]
    
    # Calculate simple density/TF (Term Frequency) score
    score = 0
    if len(jd_keywords) > 0:
        match_ratio = len(matched_keywords) / len(jd_keywords)
        # Scale to 100
        score = int(match_ratio * 100)
    
    return {
        "score": score,
        "matched_count": len(matched_keywords),
        "missing_count": len(missing_keywords),
        "top_missing_keywords": missing_keywords[:10], # Return top 10 missing
        "status": "PASS" if score >= 75 else "FAIL"
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing resume or jd arguments. Usage: python ats_parser.py '<resume>' '<jd>'"}))
        sys.exit(1)
        
    resume_text = sys.argv[1]
    jd_text = sys.argv[2]
    
    try:
        result = calculate_ats_score(resume_text, jd_text)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
