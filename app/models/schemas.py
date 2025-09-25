"""
Pydantic Schemas
Request/Response models for API endpoints
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel

# Request Models
class CallRequest(BaseModel):
    driver_name: str
    phone_number: str
    load_number: str

class VoiceSettings(BaseModel):
    temperature: float = 0.7
    speed: float = 1.0
    interruption_sensitivity: float = 0.8

class AgentConfigRequest(BaseModel):
    name: str
    prompts: str
    voice_settings: VoiceSettings

# Response Models
class CallResultResponse(BaseModel):
    id: str
    call_id: str
    driver_name: str
    phone_number: str
    load_number: str
    call_status: str
    call_outcome: Optional[str] = None
    driver_status: Optional[str] = None
    current_location: Optional[str] = None
    eta: Optional[str] = None
    emergency_type: Optional[str] = None
    emergency_location: Optional[str] = None
    escalation_status: Optional[str] = None
    full_transcript: Optional[List[Dict[str, Any]]] = None
    structured_data: Optional[Dict[str, Any]] = None
    created_at: str

class AgentConfigResponse(BaseModel):
    success: bool
    config: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

# WebSocket Models
class RetellWebhookRequest(BaseModel):
    call_id: str
    agent_id: str
    transcript: List[Dict[str, Any]]
    transcript_complete: bool
    call_metadata: Dict[str, Any]
    event: Optional[str] = None
    response: Optional[str] = None

class RetellWebhookResponse(BaseModel):
    response: str
    end_call: bool = False
