# scoring.py

from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from nlp_engine import generate_embedding


def compute_similarity(resume_text, jd_text):
    resume_embedding = generate_embedding(resume_text)
    jd_embedding = generate_embedding(jd_text)

    similarity = cosine_similarity(
        [resume_embedding],
        [jd_embedding]
    )[0][0]

    return round(float(similarity * 100), 2)


def find_missing_skills(resume_keywords, jd_keywords):
    return list(set(jd_keywords) - set(resume_keywords))


def evaluate_answer(candidate_answer, reference_answer):
    candidate_embedding = generate_embedding(candidate_answer)
    reference_embedding = generate_embedding(reference_answer)

    similarity = cosine_similarity(
        [candidate_embedding],
        [reference_embedding]
    )[0][0]

    return round(float(similarity * 20), 2)