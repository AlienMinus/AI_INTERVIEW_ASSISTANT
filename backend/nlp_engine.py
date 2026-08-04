# nlp_engine.py

from keybert import KeyBERT
from sentence_transformers import SentenceTransformer

# Initialize models as None for lazy loading
kw_model = None
embedding_model = None


def extract_keywords(text, top_n=20):
    global kw_model
    if kw_model is None:
        print("Initializing KeyBERT model...")
        kw_model = KeyBERT()

    keywords = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 2),
        stop_words='english',
        top_n=top_n
    )
    return [kw[0] for kw in keywords]


def generate_embedding(text):
    global embedding_model
    if embedding_model is None:
        print("Initializing SentenceTransformer model...")
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
    return embedding_model.encode(text)