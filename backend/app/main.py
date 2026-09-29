import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base
import app.models # ensure all models are registered
from app.routers import (
    auth_router,
    sessions_router,
    questions_router,
    answers_router,
    stt_router,
    history_router,
    system_router,
)

# Auto-create tables on startup (graceful handling if remote DB is unreachable locally)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    import logging
    logging.getLogger("opic_startup").warning(f"Database initialization deferred (remote DB unreachable or port blocked): {e}")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="A comprehensive OPIc practice simulation platform designed to help Vietnamese learners reach Intermediate High (IH). Not affiliated with ACTFL or LTI."
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directories for audio files and reports
os.makedirs(settings.AUDIO_CACHE_DIR, exist_ok=True)
os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)

app.mount("/data/audio_cache", StaticFiles(directory=settings.AUDIO_CACHE_DIR), name="audio_cache")
app.mount("/data/uploads", StaticFiles(directory=settings.AUDIO_UPLOAD_DIR), name="uploads")
app.mount("/data/reports", StaticFiles(directory=settings.REPORTS_DIR), name="reports")

# Include API Routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(questions_router, prefix="/api")
app.include_router(answers_router, prefix="/api")
app.include_router(stt_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(system_router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "healthy"}

# Frontend SPA Serving (When deployed as a unified single service)
# Checks both relative paths for local build and Docker container build
frontend_dist_paths = [
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    Path("/app/frontend/dist"),
    Path(__file__).resolve().parent.parent / "dist"
]

frontend_dist = next((p for p in frontend_dist_paths if p.exists() and (p / "index.html").exists()), None)

if frontend_dist:
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Ignore API and system routes
        if full_path.startswith("api") or full_path.startswith("data") or full_path.startswith("ws") or full_path == "docs" or full_path == "openapi.json":
            raise HTTPException(status_code=404, detail="Not Found")
        
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "disclaimer": "OPIc Practice Studio is an independent educational practice platform and is not affiliated with, sponsored by, or endorsed by ACTFL or Language Testing International (LTI).",
            "docs_url": "/docs"
        }
