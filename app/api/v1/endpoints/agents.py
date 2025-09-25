"""
Agent Management Endpoints
Handles agent configuration, creation, and management
"""

from typing import List
from fastapi import APIRouter, HTTPException
from retell import Retell

from app.core.config import settings
from app.models.schemas import AgentConfigRequest, AgentConfigResponse
from app.services.database import get_database_service

router = APIRouter()

# Initialize Retell client
retell_client = Retell(api_key=settings.RETELL_API_KEY)

@router.get("/agent-config", response_model=AgentConfigResponse)
def get_agent_config():
    """Get the current active agent configuration"""
    try:
        db = get_database_service()
        config = db.get_active_agent_config()
        
        if config:
            return AgentConfigResponse(success=True, config=config)
        else:
            return AgentConfigResponse(success=False, message="No active agent configuration found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent config: {str(e)}")

@router.post("/agent-config")
def save_agent_config(config_request: AgentConfigRequest):
    """Save or update agent configuration"""
    try:
        db = get_database_service()
        config_id = db.save_agent_config({
            "name": config_request.name,
            "prompts": config_request.prompts,
            "voice_settings": config_request.voice_settings.model_dump()
        })
        
        if config_id:
            return {
                "success": True, 
                "config_id": config_id, 
                "message": "Agent configuration saved successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save agent configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save agent config: {str(e)}")

@router.get("/agent-configs")
def get_all_agent_configs():
    """Get all agent configurations"""
    try:
        db = get_database_service()
        configs = db.get_all_agent_configs()
        return {"success": True, "configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent configs: {str(e)}")

@router.post("/create")
def create_agent():
    """Create a Retell AI agent with custom LLM webhook"""
    try:
        response = retell_client.agent.create(
            agent_name="Logistics Dispatch Agent",
            voice_id="11labs-Adrian",
            response_engine={
                "type": "custom-llm",
                "llm_websocket_url": settings.LLM_WEBSOCKET_URL
            },
            voice_temperature=0.7,
            voice_speed=1.0,
            interruption_sensitivity=0.8,
            enable_backchannel=True,
            backchannel_frequency=0.3,
            backchannel_words=["mm-hmm", "I see", "okay", "right"],
            end_call_after_silence_ms=10000,
            max_call_duration_ms=300000,
            language="en-US"
        )
        
        return {"success": True, "agent": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(e)}")
