from fastapi import FastAPI

app = FastAPI(title="IR10 Radio")


@app.get("/health")
def health():
    return {"status": "ok"}
