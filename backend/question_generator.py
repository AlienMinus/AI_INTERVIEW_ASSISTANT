# question_generator.py

import requests


def determine_level(score):
    if score >= 80:
        return "Advanced system design and architecture level"
    elif score >= 60:
        return "Intermediate implementation level"
    elif score >= 40:
        return "Fundamental technical level"
    else:
        return "Basic conceptual level"


def generate_questions(
    resume_keywords,
    jd_keywords,
    missing_skills,
    score,
    api_key
):

    level = determine_level(score)

    prompt = f"""
You are an expert technical interviewer.

Candidate match score: {score}/100
Interview Level: {level}

Job Description Keywords:
{jd_keywords}

Resume Keywords:
{resume_keywords}

Missing Skills:
{missing_skills}

Generate exactly 5 interview questions.
Focus more on missing skills and weak areas.
Return only numbered questions.
"""

    response = requests.post(
        "https://chatgpt-42.p.rapidapi.com/gpt4",
        headers={
            "Content-Type": "application/json",
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "chatgpt-42.p.rapidapi.com"
        },
        json={
            "messages": [{"role": "user", "content": prompt}],
            "web_access": False
        }
    )

    data = response.json()

    text = data.get("result") or \
           data.get("choices", [{}])[0].get("message", {}).get("content", "")

    questions = [
        q.strip()
        for q in text.split("\n")
        if q.strip()
    ]

    return questions[:5]