"""
API v1 Router
Combines all API endpoints
"""

from fastapi import APIRouter

from app.api.v1.endpoints import agents, calls, websocket

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(calls.router, prefix="/calls", tags=["calls"])  
api_router.include_router(websocket.router, prefix="", tags=["websocket"])
