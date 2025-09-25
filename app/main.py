"""
AI Voice Agent FastAPI Application
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI Voice Agent Tool for Logistics Dispatch",
    version=settings.VERSION,
    openapi_url="/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes (direct routes without /api/v1 prefix)
from app.api.v1.endpoints import agents, calls, websocket
app.include_router(agents.router, prefix="", tags=["agents"])
app.include_router(calls.router, prefix="", tags=["calls"])
app.include_router(websocket.router, prefix="", tags=["websocket"])

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "FastAPI app is running",
        "version": settings.VERSION,
        "project": settings.PROJECT_NAME
    }

# Serve static files (React build) - IMPORTANT: This must be last!
# Mount static files at a specific path to avoid conflicts with API routes
if os.path.exists("frontend/build"):
    app.mount("/", StaticFiles(directory="frontend/build", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
