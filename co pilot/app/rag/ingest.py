import os
import json
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

DATA_DIR = RAG_DIR / "data"

VECTOR_STORE = RAG_DIR / "vector_store.json"


# =========================================================
# DOCUMENTS
# =========================================================

DOCUMENTS = [

    {
        "title": "Restaurant Refund Policy",
        "content": """
        Customers can request a refund for incorrect or missing food items.
        Refund requests should be reviewed by the restaurant manager.
        Refunds should normally be processed using the original payment method.
        """
    },

    {
        "title": "Customer Complaint Policy",
        "content": """
        Customer complaints should be handled politely and professionally.
        Staff should listen to the customer, understand the problem,
        apologize when appropriate, and inform the restaurant manager
        if the issue requires escalation.
        """
    },

    {
        "title": "Kitchen Hygiene Policy",
        "content": """
        Kitchen staff must maintain proper hygiene.
        Food preparation surfaces should be cleaned regularly.
        Staff should wash their hands before handling food.
        Raw and cooked food should be stored separately.
        """
    },

    {
        "title": "Restaurant Opening Procedure",
        "content": """
        Before opening the restaurant, staff should check the kitchen,
        inventory, equipment, dining area and billing system.
        The restaurant should only open after the manager confirms
        that the required systems are ready.
        """
    },

    {
        "title": "Restaurant Closing Procedure",
        "content": """
        At closing time, staff should clean the kitchen,
        check remaining inventory, switch off unnecessary equipment,
        verify the billing system and secure the restaurant.
        """
    },

    {
        "title": "Inventory Procedure",
        "content": """
        Inventory should be checked regularly.
        Low-stock ingredients should be reported to the manager.
        Expired or damaged food items should not be used.
        Inventory quantities should be updated after receiving new stock.
        """
    },

    {
        "title": "Staff Customer Service",
        "content": """
        Staff should communicate politely with customers.
        Orders should be confirmed before being sent to the kitchen.
        Customers should be informed if there is a significant delay.
        """
    },

]


# =========================================================
# EMBEDDING
# =========================================================

def create_embeddings(texts):

    response = client.models.embed_content(

        model=EMBEDDING_MODEL,

        contents=texts,

        config=types.EmbedContentConfig(

            task_type="RETRIEVAL_DOCUMENT",

            output_dimensionality=768

        )
    )

    return [
        embedding.values
        for embedding in response.embeddings
    ]


# =========================================================
# CREATE VECTOR STORE
# =========================================================

def build_vector_store():

    print("\n===================================")
    print("BUILDING RAG VECTOR STORE")
    print("===================================\n")

    texts = []

    for document in DOCUMENTS:

        text = (
            f"Title: {document['title']}\n"
            f"Content: {document['content'].strip()}"
        )

        texts.append(text)


    print(f"Documents: {len(texts)}")

    print("Creating embeddings...")

    embeddings = create_embeddings(texts)

    vector_store = []


    for document, text, embedding in zip(
        DOCUMENTS,
        texts,
        embeddings
    ):

        vector_store.append({

            "title":
                document["title"],

            "text":
                text,

            "embedding":
                embedding

        })


    with open(
        VECTOR_STORE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            vector_store,
            file,
            ensure_ascii=False
        )


    print("\n===================================")
    print("RAG VECTOR STORE CREATED")
    print("===================================")

    print(
        f"Saved to: {VECTOR_STORE}"
    )

    print(
        f"Documents indexed: {len(vector_store)}"
    )


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    build_vector_store()