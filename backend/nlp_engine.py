# nlp_engine.py

from keybert import KeyBERT
from sentence_transformers import SentenceTransformer

# Load models once (important for performance)
kw_model = KeyBERT()
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')


def extract_keywords(text, top_n=20):
    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 2),
        stop_words='english',
        top_n=top_n
    )
    return [kw[0] for kw in keywords]


def generate_embedding(text):
    return embedding_model.encode(text)