from fastapi import FastAPI

app = FastAPI(
    title="Rasoi Saathi API",
    version="1.0.0"
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "rasoi-saathi"
    }