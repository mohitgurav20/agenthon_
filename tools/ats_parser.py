import sys
import json
import re
import os

def clean_text(text):
    # Lowercase and strip punctuation/extra whitespace
    text = text.lower()
    text = re.sub(r'[^\w\s\-\.\@]', ' ', text)
    return text

def extract_keywords(text, stop_words):
    words = re.findall(r'\b[a-z]{3,20}\b', clean_text(text))
    # Filter out common stop words and numeric strings
    keywords = [w for w in words if w not in stop_words and not w.isdigit()]
    return list(set(keywords))

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Missing arguments. Usage: python ats_parser.py <resume_path> <jd_path>"
        }))
        sys.exit(1)

    resume_path = sys.argv[1]
    jd_path = sys.argv[2]

    # Standard English Stop Words to filter out
    stop_words = {
        'and', 'the', 'for', 'with', 'you', 'that', 'this', 'are', 'was', 'were', 'will', 'your',
        'from', 'their', 'about', 'have', 'has', 'had', 'been', 'which', 'who', 'whom', 'whose',
        'this', 'these', 'those', 'their', 'its', 'but', 'not', 'our', 'out', 'into', 'over', 'both',
        'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very', 'sincerely', 'interested', 'role',
        'job', 'work', 'working', 'company', 'team', 'highly', 'good', 'great', 'about', 'other', 'been'
    }

    try:
        if not os.path.exists(resume_path):
            return print(json.dumps({"success": False, "error": f"Resume file not found: {resume_path}"}))
        if not os.path.exists(jd_path):
            return print(json.dumps({"success": False, "error": f"Job description file not found: {jd_path}"}))

        with open(resume_path, 'r', encoding='utf-8') as f:
            resume_text = f.read()
        with open(jd_path, 'r', encoding='utf-8') as f:
            jd_text = f.read()

        # 1. Keyword Matching Analysis
        jd_keywords = extract_keywords(jd_text, stop_words)
        resume_clean = clean_text(resume_text)

        matched_keywords = []
        missing_keywords = []

        for kw in jd_keywords:
            # Check if keyword exists as a substring or whole word boundary
            if re.search(r'\b' + re.escape(kw) + r'\b', resume_clean):
                matched_keywords.append(kw)
            else:
                missing_keywords.append(kw)

        keyword_score = 0
        if len(jd_keywords) > 0:
            keyword_score = round((len(matched_keywords) / len(jd_keywords)) * 100, 1)

        # 2. Structural & Section Verification
        # Check standard resume headers in markdown (e.g. ## Experience, **Skills**)
        sections = {
            "Contact": [r'\bcontact\b', r'\bemail\b', r'\bphone\b', r'\blinkedin\b', r'\bgithub\b'],
            "Education": [r'\beducation\b', r'\bdegree\b', r'\buniversity\b', r'\bcollege\b'],
            "Experience": [r'\bexperience\b', r'\bwork\b', r'\bemployment\b', r'\bhistory\b', r'\bprofessional\b'],
            "Skills": [r'\bskills\b', r'\btechnologies\b', r'\btools\b', r'\bexpertise\b'],
            "Projects": [r'\bprojects\b', r'\bachievements\b', r'\baccomplishments\b']
        }

        found_sections = []
        missing_sections = []
        structure_score = 0

        for sec, patterns in sections.items():
            found = False
            for pat in patterns:
                if re.search(pat, resume_clean):
                    found = True
                    break
            if found:
                found_sections.append(sec)
                structure_score += 20
            else:
                missing_sections.append(sec)

        # 3. Dynamic Feedback Generation
        feedback_points = []
        if len(missing_sections) > 0:
            feedback_points.append(f"Add missing sections to improve ATS readability: {', '.join(missing_sections)}.")
        
        # Suggest matching top missing keywords
        top_missing = missing_keywords[:8]
        if len(top_missing) > 0:
            feedback_points.append(f"Incorporate these missing key technologies/skills: {', '.join(top_missing)}.")

        # Length validation
        word_count = len(resume_text.split())
        if word_count < 150:
            feedback_points.append("Your resume is too short (under 150 words). Expand your project details.")
            structure_score = max(0, structure_score - 15)
        elif word_count > 600:
            feedback_points.append("Your resume is very long (over 600 words). Keep it concise for single-page optimization.")

        # Overall Weighted Score (60% Keyword Density, 40% Structure Layout)
        ats_score = round((keyword_score * 0.6) + (structure_score * 0.4), 1)

        result = {
            "success": True,
            "atsScore": ats_score,
            "keywordScore": keyword_score,
            "structureScore": float(structure_score),
            "wordCount": word_count,
            "matchedKeywords": matched_keywords[:15],
            "missingKeywords": top_missing,
            "missingSections": missing_sections,
            "feedback": " ".join(feedback_points) if feedback_points else "Excellent resume structure and keyword matching. Ready to apply!"
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"ATS parser script failed: {str(e)}"
        }))

if __name__ == "__main__":
    main()
