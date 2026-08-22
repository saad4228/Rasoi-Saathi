from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

_VECTOR_STORE_PATH = Path(__file__).resolve().parent / "vector_store.json"
_EMBEDDING_MODEL = "gemini-embedding-001"
_TOP_K = 3
_MIN_SCORE = 0.55  # ignore results below this relevance threshold


# ──────────────────────────────────────────────
# Vector store (loaded once, cached in memory)
# ──────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_vector_store() -> list[dict[str, Any]]:
    if not _VECTOR_STORE_PATH.exists():
        return []
    with open(_VECTOR_STORE_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ──────────────────────────────────────────────
# Cosine similarity
# ──────────────────────────────────────────────

def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ──────────────────────────────────────────────
# Query embedding (one call per user message)
# ──────────────────────────────────────────────

def _embed_query(query: str, api_key: str) -> list[float] | None:
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.embed_content(
            model=_EMBEDDING_MODEL,
            contents=query,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=768,
            ),
        )
        return response.embeddings[0].values
    except Exception:  # noqa: BLE001
        return None


# ──────────────────────────────────────────────
# Public function — used by CopilotService
# ──────────────────────────────────────────────

def get_policy_context(query: str, api_key: str | None) -> str:
    """
    Return the top-k most relevant restaurant policy snippets for the given
    query, formatted as a block that can be prepended to the system prompt.

    Returns an empty string when:
    - api_key is None / empty
    - the vector store file is absent
    - the embedding call fails
    - no result reaches the minimum relevance threshold
    """
    if not api_key:
        return ""

    store = _load_vector_store()
    if not store:
        return ""

    query_embedding = _embed_query(query, api_key)
    if query_embedding is None:
        return ""

    scored = [
        {"title": doc["title"], "text": doc["text"], "score": _cosine(query_embedding, doc["embedding"])}
        for doc in store
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    top = [r for r in scored[:_TOP_K] if r["score"] >= _MIN_SCORE]

    if not top:
        return ""

    parts = [f"### {r['title']}\n{r['text']}" for r in top]
    return "RESTAURANT POLICY CONTEXT (use only when directly relevant):\n\n" + "\n\n".join(parts)
