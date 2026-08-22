import os
import json
import math
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv()


# =========================================================
# CONFIG
# =========================================================

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env")


client = genai.Client(api_key=API_KEY)

EMBEDDING_MODEL = "gemini-embedding-001"

RAG_DIR = Path(__file__).resolve().parent

VECTOR_STORE = RAG_DIR / "vector_store.json"


# =========================================================
# LOAD VECTOR STORE
# =========================================================

def load_vector_store():

    if not VECTOR_STORE.exists():

        raise FileNotFoundError(
            "RAG vector store not found. "
            "Run: python -m app.rag.ingest"
        )


    with open(
        VECTOR_STORE,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# =========================================================
# CREATE QUERY EMBEDDING
# =========================================================

def create_query_embedding(
    query: str
):

    response = client.models.embed_content(

        model=EMBEDDING_MODEL,

        contents=query,

        config=types.EmbedContentConfig(

            task_type="RETRIEVAL_QUERY",

            output_dimensionality=768

        )
    )

    return response.embeddings[0].values


# =========================================================
# COSINE SIMILARITY
# =========================================================

def cosine_similarity(
    vector_a,
    vector_b
):

    dot_product = sum(
        a * b
        for a, b in zip(
            vector_a,
            vector_b
        )
    )

    magnitude_a = math.sqrt(
        sum(
            a * a
            for a in vector_a
        )
    )

    magnitude_b = math.sqrt(
        sum(
            b * b
            for b in vector_b
        )
    )


    if magnitude_a == 0 or magnitude_b == 0:

        return 0.0


    return (
        dot_product /
        (magnitude_a * magnitude_b)
    )


# =========================================================
# RETRIEVE
# =========================================================

def retrieve(
    query: str,
    top_k: int = 3
):

    vector_store = load_vector_store()

    query_embedding = create_query_embedding(
        query
    )


    results = []


    for document in vector_store:

        score = cosine_similarity(

            query_embedding,

            document["embedding"]

        )


        results.append({

            "title":
                document["title"],

            "text":
                document["text"],

            "score":
                score

        })


    results.sort(

        key=lambda x: x["score"],

        reverse=True

    )


    return results[:top_k]


# =========================================================
# GET CONTEXT
# =========================================================

def get_context(
    query: str,
    top_k: int = 3
):

    results = retrieve(

        query,

        top_k

    )


    if not results:

        return ""


    context_parts = []


    for result in results:

        context_parts.append(

            f"### {result['title']}\n"
            f"{result['text']}\n"
            f"Relevance: "
            f"{result['score']:.4f}"

        )


    return "\n\n".join(
        context_parts
    )


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    question = input(
        "\nAsk a restaurant question: "
    )


    print("\nSearching RAG...\n")


    results = retrieve(

        question,

        top_k=3

    )


    for result in results:

        print(
            f"\nTITLE: {result['title']}"
        )

        print(
            f"SCORE: {result['score']:.4f}"
        )

        print(
            f"TEXT:\n{result['text']}"
        )

        print(
            "--------------------------------"
        )