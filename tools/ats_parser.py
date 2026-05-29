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
    
    # Advanced: Filter JD tokens to likely keywords (nouns, tech terms, etc.)
    # In a real system, we'd use SpaCy. Here we use length and frequency heuristics.
    jd_keywords = {kw for kw, count in jd_counts.items() if count >= 1 and len(kw) > 3}
    
    matched_keywords = [kw for kw in jd_keywords if kw in resume_counts]
    missing_keywords = [kw for kw in jd_keywords if kw not in resume_counts]
    
    # 1. Keyword Score
    keyword_score = 0
    if len(jd_keywords) > 0:
        match_ratio = len(matched_keywords) / len(jd_keywords)
        # Boost score slightly to simulate partial matches (e.g., plurals)
        keyword_score = min(100, int((match_ratio * 1.2) * 100))
        
    # 2. Structure/Section Score
    sections = ['experience', 'education', 'skills', 'projects', 'summary']
    found_sections = [s for s in sections if s in resume_text.lower()]
    missing_sections = [s for s in sections if s not in resume_text.lower()]
    structure_score = int((len(found_sections) / len(sections)) * 100)
    
    # 3. Formatting & Word Count Score
    word_count = len(resume_text.split())
    word_count_score = 100
    if word_count < 200:
        word_count_score -= 30
    elif word_count > 1000:
        word_count_score -= 20
        
    # Overall ATS Score (Weighted average)
    # Keywords (60%), Structure (30%), Formatting (10%)
    overall_score = int((keyword_score * 0.6) + (structure_score * 0.3) + (word_count_score * 0.1))
    
    feedback = []
    if keyword_score < 80:
        feedback.append("Keyword match is low. Add missing critical skills from the JD.")
    if len(missing_sections) > 0:
        feedback.append(f"Missing crucial ATS sections: {', '.join(missing_sections).title()}.")
    if word_count < 200:
        feedback.append("Resume is too short. Expand on your achievements using the XYZ format.")
        
    if not feedback:
        feedback.append("Excellent ATS compatibility! Your resume structure and keyword density are optimal.")
        
    return {
        "atsScore": overall_score,
        "keywordScore": keyword_score,
        "structureScore": structure_score,
        "wordCount": word_count,
        "missingKeywords": missing_keywords[:8],
        "missingSections": missing_sections,
        "feedback": " ".join(feedback),
        "status": "PASS" if overall_score >= 80 else "FAIL"
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing resume or jd arguments. Usage: python ats_parser.py '<resume>' '<jd>'"}))
        sys.exit(1)
        
    import os
    if os.path.exists(sys.argv[1]):
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            resume_text = f.read()
    else:
        resume_text = sys.argv[1]

    if os.path.exists(sys.argv[2]):
        with open(sys.argv[2], 'r', encoding='utf-8') as f:
            jd_text = f.read()
    else:
        jd_text = sys.argv[2]
    
    try:
        result = calculate_ats_score(resume_text, jd_text)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
