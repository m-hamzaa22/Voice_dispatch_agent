"""
Call Management Endpoints
Handles call triggering, history, and processing
"""

import asyncio
import time
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from retell import Retell

from app.core.config import settings
from app.models.schemas import CallRequest, CallResultResponse
from app.services.database import get_database_service


router = APIRouter()

# Initialize Retell client
retell_client = Retell(api_key=settings.RETELL_API_KEY)

# In-memory store for active calls
active_calls: Dict[str, Dict[str, Any]] = {}

@router.post("/trigger-call")
async def trigger_phone_call(call_request: CallRequest):
    """Trigger a phone call to a driver"""
    try:
        response = retell_client.call.create_phone_call(
            agent_id=settings.RETELL_AGENT_ID,
            to_number=call_request.phone_number,
            from_number=settings.RETELL_PHONE_NUMBER,
            metadata={
                "driver_name": call_request.driver_name,
                "load_number": call_request.load_number
            }
        )
        
        return {"success": True, "call": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger call: {str(e)}")

@router.post("/create-test-call")
async def create_web_call(request: dict):
    """Create a web call with dynamic variables for testing"""
    try:
        # Get published agent info
        published_agent_id, agent_version = get_published_agent_info()
        
        call_metadata = {
            "driver_name": request.get("driver_name", "Driver"),
            "phone_number": request.get("phone_number", ""),
            "load_number": request.get("load_number", "Load")
        }
        
        call_params = {
            "agent_id": published_agent_id,
            "metadata": call_metadata
        }
        
        if agent_version is not None:
            call_params["agent_version"] = agent_version
        
        response = retell_client.call.create_web_call(**call_params)
        
        # Store variables for WebSocket
        active_calls[response.call_id] = call_metadata
        
        # Create database record
        asyncio.create_task(create_call_database_record(response.call_id, call_metadata))
        
        return {
            "success": True, 
            "call_id": response.call_id, 
            "access_token": response.access_token
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create web call: {str(e)}")

@router.get("/call-history")
async def get_call_history(limit: int = 50):
    """Get call history (optimized - no detailed data per call)"""
    try:
        db = get_database_service()
        calls = db.get_call_history(limit=limit)
        
        # Return basic call history without expensive per-call lookups
        # Detailed data can be fetched via /call-details/{call_id} when needed
        return {"success": True, "calls": calls}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get call history: {str(e)}")

@router.get("/call-details/{call_id}")
async def get_call_details(call_id: str):
    """Get detailed call information"""
    try:
        db = get_database_service()
        call_result = db.get_call_with_tools(call_id)
        
        if not call_result:
            raise HTTPException(status_code=404, detail="Call not found")
        
        conversation = db.get_call_conversation(call_id)
        call_result['full_conversation'] = conversation
        
        return {"success": True, "call": call_result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get call details: {str(e)}")

@router.post("/recording-webhook")
async def recording_webhook(recording_data: Dict[str, Any]):
    """Handle call recording and process final transcript"""
    try:
        call_id = recording_data.get("call_id")
        transcript = recording_data.get("transcript", [])
        
        # Use accumulated data from real-time extraction (no additional API call needed!)
        call_data = active_calls.get(call_id, {})
        structured_data = call_data.get("extracted_data", {})
        
        # Use our stored transcript if Retell's transcript is empty or missing
        if not transcript and call_data.get("full_transcript"):
            transcript = call_data.get("full_transcript", [])
            print(f"📝 Using stored transcript with {len(transcript)} messages")
        
        # If no accumulated data, create minimal fallback data
        if not structured_data:
            print(f"⚠️ No accumulated data for {call_id}, using minimal fallback")
            structured_data = {
                "call_outcome": "Call Completed",
                "confidence": 0.3,
                "summary": f"Call completed with {call_data.get('driver_name', 'driver')} about load {call_data.get('load_number', 'N/A')} - no data extracted during conversation"
            }
        else:
            print(f"✅ Using accumulated data for {call_id}: {len(structured_data)} fields")
            # Add final summary
            structured_data["summary"] = f"Call completed with {call_data.get('driver_name', 'driver')} about load {call_data.get('load_number', 'N/A')}"
        
        # Store in database
        db = get_database_service()
        update_data = {
            "call_status": "completed",
            "call_ended_at": time.time(),
            "full_transcript": transcript,
            "structured_data": structured_data
        }
        
        # Add structured data fields
        for field in ["call_outcome", "driver_status", "current_location", "eta", 
                     "emergency_type", "emergency_location", "escalation_status"]:
            if field in structured_data:
                update_data[field] = structured_data[field]
        
        success = await db.update_call_result(call_id, update_data)
        
        # Clean up call data
        if call_id and call_id in active_calls:
            del active_calls[call_id]
        
        return {"success": True, "structured_data": structured_data}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_published_agent_info():
    """Get published agent information"""
    try:
        agents = retell_client.agent.list()
        
        published_agents = []
        for agent in agents:
            if (agent.agent_id == settings.RETELL_AGENT_ID and 
                agent.is_published and 
                agent.response_engine.type == 'custom-llm'):
                version = getattr(agent, 'version', 0)
                published_agents.append((agent, version))
        
        if published_agents:
            published_agents.sort(key=lambda x: x[1], reverse=True)
            agent, version = published_agents[0]
            return agent.agent_id, version
        
        return settings.RETELL_AGENT_ID, None
        
    except Exception as e:
        return settings.RETELL_AGENT_ID, None

async def create_call_database_record(call_id: str, call_metadata: Dict[str, Any]):
    """Create initial database record for the call"""
    try:
        db = get_database_service()
        
        call_data = {
            "call_id": call_id,
            "driver_name": call_metadata.get("driver_name", "Driver"),
            "phone_number": call_metadata.get("phone_number", ""),
            "load_number": call_metadata.get("load_number", "Load"),
            "call_outcome": "In Progress",
            "driver_status": "Unknown",
            "current_location": "Not provided",
            "eta": "Not provided",
            "structured_data": {"call_metadata": call_metadata}
        }
        
        await db.create_call_result(call_data)
            
    except Exception as e:
        print(f"❌ Error creating call database record: {e}")
