# question_generator.py

import requests
import random
import json
import os


def determine_level(score):
    if score >= 80:
        return "Advanced system design and architecture level"
    elif score >= 60:
        return "Intermediate implementation level"
    elif score >= 40:
        return "Fundamental technical level"
    else:
        return "Basic conceptual level"


def load_questions(filename):
    try:
        base_path = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(base_path, "data", filename)
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []


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

Generate exactly 10 interview questions.
The first 5 must be Technical questions focusing on missing skills and weak areas.
The last 5 must be Behavioral/Non-Technical questions.
Return only numbered questions.
"""

    for attempt in range(2):
        try:
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
                },
                timeout=4  # Reduce timeout to fail faster
            )
            response.raise_for_status()
            data = response.json()

            text = data.get("result") or \
                   data.get("choices", [{}])[0].get("message", {}).get("content", "")

            questions = [
                q.strip()
                for q in text.split("\n")
                if q.strip()
            ]
            return questions[:10]

        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            if attempt == 1:  # Last attempt
                print("Max retries reached. Using fallback questions.")
                
                # Load questions from JSON files
                tech_pool = load_questions("tech.json")
                non_tech_pool = load_questions("non-tech.json")

                # Shuffle missing skills to pick randomly
                shuffled_skills = list(missing_skills)
                random.shuffle(shuffled_skills)

                # Prepare a list of available topics for injection
                # Priority: Missing Skills -> JD Keywords -> Generic Fallbacks
                fallback_topics = ["system architecture", "optimization", "scalability", "software engineering"]
                available_topics = shuffled_skills + jd_keywords + fallback_topics

                # --- ROUND 1: TECHNICAL (Dynamic based on gaps) ---
                technical_round = []
                random.shuffle(tech_pool)

                for q in tech_pool:
                    if len(technical_round) >= 5:
                        break
                    
                    if "{topic}" in q:
                        # Pop a topic to ensure variety, recycle if needed
                        topic = available_topics.pop(0) if available_topics else "technology"
                        technical_round.append(q.format(topic=topic))
                        # Add used topic back to end of list in case we run out
                        available_topics.append(topic)
                    else:
                        technical_round.append(q)

                # --- ROUND 2: NON-TECHNICAL (Behavioral) ---
                non_technical_round = []
                
                if isinstance(non_tech_pool, dict):
                    # Categorized questions: Pick 1 from each random category
                    categories = list(non_tech_pool.keys())
                    random.shuffle(categories)
                    
                    for cat in categories:
                        if len(non_technical_round) >= 5:
                            break
                        if non_tech_pool[cat]:
                            # Add category name to question for context (optional, but helpful)
                            question = random.choice(non_tech_pool[cat])
                            # non_technical_round.append(f"[{cat}] {question}") # Uncomment to show category
                            non_technical_round.append(question)
                else:
                    # Fallback for flat list
                    non_technical_round = random.sample(non_tech_pool, min(5, len(non_tech_pool)))

                return technical_round + non_technical_round