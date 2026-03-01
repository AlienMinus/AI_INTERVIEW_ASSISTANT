# question_generator.py

import random
import json
import os


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
    score
):
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