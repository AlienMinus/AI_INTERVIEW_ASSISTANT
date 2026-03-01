# main.py

import os
# Suppress TensorFlow logs
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from nlp_engine import extract_keywords
from scoring import compute_similarity, find_missing_skills, evaluate_answer
from question_generator import generate_questions

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({"message": "AI Interview Backend Running"})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/analyze", methods=["POST"])
def analyze():

    data = request.json
    resume_text = data.get("resume")
    jd_text = data.get("job_description")
    api_key = data.get("api_key") or os.getenv("RAPID_API_KEY")

    if not resume_text or not jd_text:
        return jsonify({"error": "Missing resume or job description"}), 400

    # 1️⃣ Extract keywords
    resume_keywords = extract_keywords(resume_text)
    jd_keywords = extract_keywords(jd_text)

    # 2️⃣ Compute match score
    score = compute_similarity(resume_text, jd_text)

    # 3️⃣ Find missing skills
    missing_skills = find_missing_skills(
        resume_keywords,
        jd_keywords
    )

    # 4️⃣ Generate adaptive questions
    questions = generate_questions(
        resume_keywords,
        jd_keywords,
        missing_skills,
        score,
        api_key
    )

    return jsonify({
        "score": score,
        "resume_keywords": resume_keywords,
        "jd_keywords": jd_keywords,
        "missing_skills": missing_skills,
        "questions": questions
    })


@app.route("/evaluate", methods=["POST"])
def evaluate():

    data = request.json
    candidate_answer = data.get("candidate_answer")
    reference_answer = data.get("reference_answer")

    if not candidate_answer or not reference_answer:
        return jsonify({"error": "Missing answer fields"}), 400

    score = evaluate_answer(candidate_answer, reference_answer)

    return jsonify({
        "answer_score": score
    })


@app.route("/extract-text", methods=["POST"])
def extract_text():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename.lower()
    text = ""

    try:
        if filename.endswith(".docx"):
            import docx
            doc = docx.Document(file)
            text = "\n".join([para.text for para in doc.paragraphs])
        elif filename.endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(file)
            text = "\n".join([page.extract_text() for page in reader.pages])
        else:
            return jsonify({"error": "Unsupported file type"}), 400

        return jsonify({"text": text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)