"""
CaféSmart ML Microservice — FastAPI Application

Internal service consumed exclusively by the Next.js server (AD-5).
No CORS middleware — network isolation is the trust boundary.
"""

from fastapi import FastAPI

app = FastAPI(
    title="CaféSmart ML Service",
    version="0.1.0",
    description="Internal ML inference service for CaféSmart canteen system.",
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
