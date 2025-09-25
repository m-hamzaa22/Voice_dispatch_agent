"""
WebSocket Endpoints
Handles real-time communication with Retell AI - EXACT COPY from working backend
"""

import asyncio
import json
import time
from typing import List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings

router = APIRouter()

# Import active_calls from calls module
from app.api.v1.endpoints.calls import active_calls

@router.websocket("/llm-websocket/{call_id}")
async def llm_websocket(websocket: WebSocket, call_id: str):
    """WebSocket endpoint for custom LLM integration with Retell AI"""
    await websocket.accept()
    print(f"🔌 WebSocket connected for call: {call_id}")
    
    # Get variables from temporary storage (will be cleaned up after call)
    call_data = active_calls.get(call_id, {})
    driver_name = call_data.get("driver_name", "Driver")
    load_number = call_data.get("load_number", "your load")
    
    print(f"✅ Using variables for OpenAI: driver={driver_name}, load={load_number}")
    
    
    try:
        # Generate first message dynamically using LLM with variables
        print(f"🎯 Generating first message with LLM for {driver_name}, load {load_number}")
        first_message_content = await generate_first_message_simple(driver_name, load_number)
        print(f"✅ LLM generated first message: {first_message_content}")
        
        first_response = {
            "response_id": 0,
            "content": first_message_content,
            "content_complete": True,
            "end_call": False
        }
        
        await websocket.send_text(json.dumps(first_response))
        print(f"✅ Sent first message: {first_message_content}")
        
        # Start ping-pong task to maintain connection
        ping_task = asyncio.create_task(send_ping_pong(websocket))
        
        # Handle ongoing conversation
        while True:
            try:
                # Receive message from Retell with timeout
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                request_data = json.loads(message)
                
                # Reduced logging: Only log essential info, not massive transcript
                interaction_type = request_data.get("interaction_type")
                response_id = request_data.get("response_id", "N/A")
                print(f"📨 Received from Retell: {interaction_type} (response_id: {response_id})")
                
                # Handle different interaction types  
                response_type = request_data.get("response_type")
                
                # Handle ping_pong responses from Retell (don't respond to these)
                if response_type == "ping_pong":
                    print("🏓 Received ping_pong from Retell")
                    continue
                
                if interaction_type == "response_required":
                    # Fast extract: Get user input without processing word arrays
                    transcript = request_data.get("transcript", [])
                    user_input = ""
                    # Get the last user message quickly
                    for entry in reversed(transcript):
                        if entry.get("role") == "user" and entry.get("content", "").strip():
                            user_input = entry.get("content", "").strip()
                            break
                    
                    if user_input:
                        # Build conversation context (exclude current user message to avoid duplication)
                        conversation_history = []
                        for entry in transcript[:-1]:  # Exclude the last message (current user input)
                            if (entry.get("content") and 
                                len(entry.get("content", "").strip()) > 0 and 
                                entry.get("content", "").strip() != user_input):  # Double-check no duplication
                                role = "assistant" if entry.get("role") == "agent" else "user"
                                conversation_history.append({
                                    "role": role,
                                    "content": entry.get("content", "").strip()
                                })
                        
                        # Keep only last 6 messages (3 exchanges) for context while staying within token limits
                        conversation_history = conversation_history[-6:]
                        
                        # Get accumulated data to provide context to LLM
                        current_accumulated_data = active_calls.get(call_id, {}).get("extracted_data", {})
                        
                        # Use combined response generation + data extraction in ONE API call
                        response_content, extracted_data = await generate_llm_response_with_extraction(user_input, driver_name, load_number, conversation_history, current_accumulated_data)
                        
                        # Store extracted data AND transcript progressively (accumulate during conversation)
                        if call_id not in active_calls:
                            active_calls[call_id] = {"driver_name": driver_name, "load_number": load_number}
                        
                        # Update with newly extracted data
                        if "extracted_data" not in active_calls[call_id]:
                            active_calls[call_id]["extracted_data"] = {}
                        
                        # Merge new data with existing (latest data takes precedence)
                        active_calls[call_id]["extracted_data"].update({
                            k: v for k, v in extracted_data.items() 
                            if v is not None and v != ""
                        })
                        
                        # Store the full conversation transcript
                        active_calls[call_id]["full_transcript"] = transcript
                        
                        print(f"💬 Stored transcript with {len(transcript)} messages")
                        
                        print(f"📊 Extracted data: {extracted_data}")
                        print(f"💾 Accumulated data: {active_calls[call_id]['extracted_data']}")
                        
                        # Check if the LLM wants to end the call (via tool calling)
                        accumulated_data = active_calls[call_id]['extracted_data']
                        should_end = extracted_data.get("should_end_call", False)
                        
                        print(f"🔍 LLM decision to end call: {should_end}")
                        if should_end:
                            print(f"📋 Call ending reason: {extracted_data.get('reason', 'No reason provided')}")
                        print(f"📋 Current accumulated data: {list(accumulated_data.keys())}")
                        
                        # Send response back to Retell
                        response = {
                            "response_id": request_data.get("response_id", 1),
                            "content": response_content,
                            "content_complete": True,
                            "end_call": should_end
                        }
                        
                        await websocket.send_text(json.dumps(response))
                        print(f"✅ Sent response: {response_content}")
                    
                elif interaction_type == "update_only":
                    # Just an update, no response needed
                    print("📊 Received update from Retell")
                    
            except asyncio.TimeoutError:
                print("⏰ Timeout waiting for message from Retell AI (30s)")
                continue
            except WebSocketDisconnect:
                print("🔌 WebSocket disconnected by client")
                break
            except Exception as e:
                print(f"❌ Error in WebSocket loop: {e}")
                break
                
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        # Cancel ping task
        if 'ping_task' in locals():
            print("🛑 Cancelling ping task...")
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                print("✅ Ping task cancelled successfully")
        
        # Finalize call when WebSocket closes
        print(f"🏁 WebSocket connection closed for call: {call_id}")
        await finalize_call_on_disconnect(call_id)

async def send_ping_pong(websocket: WebSocket):
    """Send ping_pong events every 2 seconds to maintain WebSocket connection"""
    try:
        print("🏓 Starting ping_pong task...")
        while True:
            await asyncio.sleep(2)
            ping_pong_message = {
                "response_type": "ping_pong",
                "timestamp": int(time.time() * 1000)  # Current time in milliseconds
            }
            try:
                await websocket.send_text(json.dumps(ping_pong_message))
                print(f"🏓 Sent ping_pong at {ping_pong_message['timestamp']}")
            except ConnectionResetError:
                print("🔌 WebSocket connection reset during ping_pong")
                break
            except Exception as e:
                print(f"❌ Failed to send ping_pong: {e}")
                break
    except asyncio.CancelledError:
        print("🛑 Ping pong task cancelled")
    except Exception as e:
        print(f"❌ Ping pong error: {e}")

async def generate_first_message_simple(driver_name: str, load_number: str) -> str:
    """Generate the first message using simple template for speed"""
    try:
        # Use simple template for speed - no OpenAI call needed for first message
        return f"Hi {driver_name}, this is Dispatch calling about load {load_number}. Can you give me an update on your status?"
        
    except Exception as e:
        print(f"❌ Error generating first message: {e}")
        return f"Hi {driver_name}, this is Dispatch calling about load {load_number}. How are you doing?"

async def generate_llm_response_with_extraction(user_input: str, driver_name: str, load_number: str, conversation_history: List[Dict[str, Any]] = None, accumulated_data: Dict[str, Any] = None) -> tuple[str, Dict[str, Any]]:
    """Generate response AND extract structured data in one API call using tool calling"""
    try:
        import openai
        
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Build context about what data we already have
        accumulated_info = ""
        if accumulated_data:
            info_parts = []
            if accumulated_data.get("current_location"):
                info_parts.append(f"Location: {accumulated_data['current_location']}")
            if accumulated_data.get("driver_status"):
                info_parts.append(f"Status: {accumulated_data['driver_status']}")
            if accumulated_data.get("eta"):
                info_parts.append(f"ETA: {accumulated_data['eta']}")
            if info_parts:
                accumulated_info = f"\n\nINFORMATION ALREADY COLLECTED:\n" + "\n".join(f"- {info}" for info in info_parts)
        
        # Enhanced system prompt for intelligent tool selection
        system_prompt = f"""You are a professional logistics dispatcher talking to {driver_name} about load {load_number}.{accumulated_info}

CRITICAL DECISION: Choose the correct tool based on the situation and conversation context:

🚨 USE handle_emergency_protocol IF:
- Driver mentions: accident, crash, breakdown, medical emergency, injury, stuck, stranded
- Safety concerns: "I'm hurt", "can't breathe", "pulling over", "engine smoking"
- Urgent help needed: "emergency", "urgent", "help me", "call 911"

📋 USE handle_routine_checkin IF:
- Normal status updates: driving, delayed, arrived, ETA questions
- Location updates: "I'm on I-10", "just passed Phoenix"
- Routine issues: traffic, minor delays, fuel stops
- IMPORTANT: If you already have location and driver status, ask for ETA and then END THE CALL

SMART CALL COMPLETION:
- Review what information you already have from previous messages
- For ROUTINE calls: If you have location + driver status + ETA, use the 'end_call' tool
- For EMERGENCY calls: After gathering emergency details, use the 'end_call' tool
- Don't ask redundant questions about information you already collected

TOOL SELECTION:
- Use 'handle_routine_checkin' when you need more information (location, status, ETA)
- Use 'handle_emergency_protocol' when emergency is detected (accident, breakdown, medical)
- Use 'end_call' when you have all required information and want to end the call professionally

Choose the appropriate tool and provide both a response and extract relevant data."""

        # Build messages with conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if available
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current user input
        messages.append({"role": "user", "content": user_input})
        
        # Debug: Log the conversation context being sent to OpenAI
        print(f"🧠 Sending to OpenAI - Total messages: {len(messages)}")
        print(f"📝 Context messages: {len(conversation_history)}")
        for i, msg in enumerate(messages[-3:]):  # Show last 3 messages
            role_emoji = "🤖" if msg["role"] == "assistant" else "👤" if msg["role"] == "user" else "⚙️"
            content_preview = msg["content"][:50] + "..." if len(msg["content"]) > 50 else msg["content"]
            print(f"  {role_emoji} {msg['role']}: {content_preview}")

        # Two specialized tools - LLM chooses which one to call based on situation
        routine_checkin_tool = {
            "type": "function",
            "function": {
                "name": "handle_routine_checkin",
                "description": "Handle normal driver check-in conversation - ask about location, ETA, status updates",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "response_text": {
                            "type": "string",
                            "description": "Professional dispatcher response asking for location, ETA, or status updates"
                        },
                        "call_outcome": {
                            "type": "string",
                            "description": "Current call status: 'In-Transit Update' or 'Arrival Confirmation'"
                        },
                        "driver_status": {
                            "type": "string",
                            "description": "Driver's current status: 'Driving', 'Delayed', 'Arrived', etc."
                        },
                        "current_location": {
                            "type": "string",
                            "description": "Specific location mentioned (highway, city, mile marker)"
                        },
                        "eta": {
                            "type": "string",
                            "description": "Estimated arrival time if provided"
                        },
                        "issues_delays": {
                            "type": "string",
                            "description": "Any non-emergency issues or delays mentioned"
                        },
                        "confidence": {
                            "type": "number",
                            "description": "Confidence in extracted data (0.0-1.0)",
                            "minimum": 0.0,
                            "maximum": 1.0
                        }
                    },
                    "required": ["response_text", "confidence"]
                }
            }
        }

        emergency_protocol_tool = {
            "type": "function", 
            "function": {
                "name": "handle_emergency_protocol",
                "description": "EMERGENCY DETECTED - Immediately gather critical information and escalate to human dispatcher",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "response_text": {
                            "type": "string",
                            "description": "Emergency response: acknowledge, ask if safe, get location, escalate to human dispatcher"
                        },
                        "call_outcome": {
                            "type": "string",
                            "description": "Must be 'Emergency Detected'"
                        },
                        "emergency_type": {
                            "type": "string", 
                            "description": "Type of emergency: 'Accident', 'Breakdown', 'Medical', or 'Other'"
                        },
                        "emergency_location": {
                            "type": "string",
                            "description": "Specific location of emergency (highway, mile marker, etc.)"
                        },
                        "escalation_status": {
                            "type": "string",
                            "description": "Must be 'Escalation Flagged' - human dispatcher will call back"
                        },
                        "driver_safety_status": {
                            "type": "string",
                            "description": "Is the driver safe? 'Safe', 'Injured', 'Unknown'"
                        },
                        "immediate_assistance_needed": {
                            "type": "boolean",
                            "description": "Does driver need immediate emergency services?"
                        },
                        "confidence": {
                            "type": "number",
                            "description": "Confidence in emergency assessment (0.0-1.0)",
                            "minimum": 0.0,
                            "maximum": 1.0
                        }
                    },
                    "required": ["response_text", "call_outcome", "emergency_type", "escalation_status", "confidence"]
                }
            }
        }

        end_call_tool = {
            "type": "function",
            "function": {
                "name": "end_call",
                "description": "END THE CALL - Use when you have collected all required information (location + status + ETA for routine, or emergency details)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "response_text": {
                            "type": "string",
                            "description": "Final farewell message to end the call professionally (e.g., 'Thank you for the update, drive safely!')"
                        },
                        "call_complete": {
                            "type": "boolean",
                            "description": "Must be true - indicates call should end"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Why the call is ending: 'All data collected', 'Emergency escalated', 'Driver unresponsive', etc."
                        },
                        "confidence": {
                            "type": "number",
                            "description": "Confidence that call should end (0.0-1.0)",
                            "minimum": 0.0,
                            "maximum": 1.0
                        }
                    },
                    "required": ["response_text", "call_complete", "reason", "confidence"]
                }
            }
        }

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=[routine_checkin_tool, emergency_protocol_tool, end_call_tool],
            tool_choice="required",  # Force LLM to always use one of the tools
            service_tier="priority",  # Use priority tier for faster processing
            temperature=0.3,
            timeout=10  # Slightly longer for tool calling
        )
        
        # Extract both response and data - LLM chose the appropriate tool
        if response.choices[0].message.tool_calls:
            tool_call = response.choices[0].message.tool_calls[0]
            tool_name = tool_call.function.name
            
            import json
            extracted_data = json.loads(tool_call.function.arguments)
            response_text = extracted_data.pop("response_text", "I understand. Can you provide more details?")
            
            # Add metadata about which tool was used
            extracted_data["tool_used"] = tool_name
            extracted_data["is_emergency"] = (tool_name == "handle_emergency_protocol")
            extracted_data["should_end_call"] = (tool_name == "end_call")
            
            print(f"🔧 LLM chose tool: {tool_name}")
            print(f"🚨 Emergency detected: {extracted_data['is_emergency']}")
            if extracted_data["should_end_call"]:
                print(f"🔚 LLM wants to end call: {extracted_data.get('reason', 'No reason provided')}")
            
            return response_text, extracted_data
        
        # Fallback if tool calling fails
        return "I understand. Can you provide more details about your current status?", {
            "is_emergency": False,
            "confidence": 0.5,
            "call_outcome": "In Progress"
        }
        
    except Exception as e:
        print(f"❌ Error in response generation with extraction: {e}")
        return "I understand. Can you provide more details about your current status?", {
            "is_emergency": False,
            "confidence": 0.1,
            "error": str(e)
        }

# Keep the old function as fallback
async def generate_llm_response_fallback(user_input: str, driver_name: str, load_number: str, conversation_history: List[Dict[str, Any]] = None) -> str:
    """Fallback - just generate response without extraction"""
    response_text, _ = await generate_llm_response_with_extraction(user_input, driver_name, load_number, conversation_history)
    return response_text


async def finalize_call_on_disconnect(call_id: str):
    """Finalize call when WebSocket disconnects"""
    try:
        from app.services.database import get_database_service
        
        # Get accumulated data from active_calls
        call_data = active_calls.get(call_id, {})
        extracted_data = call_data.get("extracted_data", {})
        stored_transcript = call_data.get("full_transcript", [])
        
        print(f"🏁 Finalizing call {call_id}")
        print(f"📊 Final extracted data: {extracted_data}")
        print(f"💬 Final transcript: {len(stored_transcript)} messages")
        
        # Create structured data summary
        structured_data = extracted_data.copy() if extracted_data else {}
        
        # Add call completion info
        structured_data.update({
            "call_outcome": extracted_data.get("call_outcome", "Call Completed"),
            "summary": f"Call completed with {call_data.get('driver_name', 'driver')} about load {call_data.get('load_number', 'N/A')}"
        })
        
        # Update database record
        db = get_database_service()
        update_data = {
            "call_status": "completed",
            "call_ended_at": time.time(),
            "full_transcript": stored_transcript,
            "structured_data": structured_data
        }
        
        # Add individual fields from extracted data
        for field in ["call_outcome", "driver_status", "current_location", "eta", 
                     "emergency_type", "emergency_location", "escalation_status"]:
            if field in extracted_data:
                update_data[field] = extracted_data[field]
        
        success = await db.update_call_result(call_id, update_data)
        
        if success:
            print(f"✅ Call {call_id} finalized successfully")
        else:
            print(f"❌ Failed to finalize call {call_id}")
        
        # Clean up active call data
        if call_id in active_calls:
            del active_calls[call_id]
            print(f"🧹 Cleaned up active call data for {call_id}")
            
    except Exception as e:
        print(f"❌ Error finalizing call {call_id}: {e}")