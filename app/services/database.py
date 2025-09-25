"""
Database Service
Abstracted database operations for the application
"""

import psycopg2
import psycopg2.extras
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from contextlib import contextmanager

from app.core.config import settings

def get_realistic_voice_settings(base_settings: Dict[str, Any] = None) -> Dict[str, Any]:
    """Get complete voice settings with realistic voice features"""
    if base_settings is None:
        base_settings = {}
    
    return {
        # Basic settings (can be overridden)
        "temperature": base_settings.get("temperature", 0.7),
        "speed": base_settings.get("speed", 0.8),
        "interruption_sensitivity": base_settings.get("interruption_sensitivity", 0.8),
        
        # Advanced realistic voice settings (managed by backend)
        "enable_backchannel": True,
        "backchannel_frequency": 0.8,
        "backchannel_words": ["mm-hmm", "uh-huh", "I see", "okay", "right", "got it", "sure", "alright"],
        "end_call_after_silence_ms": 10000,
        "max_call_duration_ms": 300000
    }

class DatabaseService:
    def __init__(self):
        """Initialize database service"""
        self.connection_params = self._get_connection_params()
        print("✅ Database service initialized")

    def _get_connection_params(self) -> Dict[str, str]:
        """Get database connection parameters"""
        if not all([settings.DB_USER, settings.DB_PASSWORD, settings.DB_HOST, settings.DB_NAME]):
            raise ValueError("Database connection parameters must be set")
        
        return {
            "user": settings.DB_USER,
            "password": settings.DB_PASSWORD,
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "dbname": settings.DB_NAME
        }

    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        connection = None
        try:
            connection = psycopg2.connect(**self.connection_params)
            yield connection
        except Exception as e:
            if connection:
                connection.rollback()
            raise e
        finally:
            if connection:
                connection.close()

    @contextmanager
    def get_cursor(self, connection=None):
        """Context manager for database cursors"""
        if connection:
            cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            try:
                yield cursor
            finally:
                cursor.close()
        else:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                try:
                    yield cursor
                finally:
                    cursor.close()

    # Agent Configuration Methods
    def get_active_agent_config(self) -> Optional[Dict[str, Any]]:
        """Get the currently active agent configuration"""
        try:
            with self.get_cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM agent_configurations 
                    WHERE is_active = true 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """)
                result = cursor.fetchone()
                
                if result:
                    config = dict(result)
                    if config.get('voice_settings'):
                        config['voice_settings'] = json.loads(config['voice_settings']) if isinstance(config['voice_settings'], str) else config['voice_settings']
                    return config
                return None
        except Exception as e:
            print(f"Error getting active agent config: {e}")
            return None

    async def save_agent_config(self, config_data: Dict[str, Any]) -> Optional[str]:
        """Save or update agent configuration"""
        try:
            with self.get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT id FROM agent_configurations WHERE is_active = true")
                    existing = cursor.fetchone()
                    
                    # Merge frontend voice settings with advanced realistic voice settings
                    frontend_voice_settings = config_data.get("voice_settings", {})
                    complete_voice_settings = get_realistic_voice_settings(frontend_voice_settings)
                    voice_settings_json = json.dumps(complete_voice_settings)
                    
                    if existing:
                        cursor.execute("""
                            UPDATE agent_configurations 
                            SET name = %s, prompts = %s, voice_settings = %s, updated_at = NOW()
                            WHERE id = %s
                            RETURNING id
                        """, (
                            config_data.get("name", "Updated Agent"),
                            config_data.get("prompts", ""),
                            voice_settings_json,
                            existing[0]
                        ))
                        result = cursor.fetchone()
                        if result:
                            connection.commit()
                            return result[0]
                    else:
                        cursor.execute("""
                            INSERT INTO agent_configurations (name, prompts, voice_settings, is_active)
                            VALUES (%s, %s, %s, true)
                            RETURNING id
                        """, (
                            config_data.get("name", "New Agent"),
                            config_data.get("prompts", ""),
                            voice_settings_json
                        ))
                        result = cursor.fetchone()
                        if result:
                            connection.commit()
                            return result[0]
                    
                    return None
        except Exception as e:
            print(f"Error saving agent config: {e}")
            return None

    def get_all_agent_configs(self) -> List[Dict[str, Any]]:
        """Get all agent configurations"""
        try:
            with self.get_cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM agent_configurations 
                    ORDER BY created_at DESC
                """)
                results = cursor.fetchall()
                
                configs = []
                for result in results:
                    config = dict(result)
                    if config.get('voice_settings'):
                        config['voice_settings'] = json.loads(config['voice_settings']) if isinstance(config['voice_settings'], str) else config['voice_settings']
                    configs.append(config)
                
                return configs
        except Exception as e:
            print(f"Error getting agent configs: {e}")
            return []

    # Call Results Methods
    async def create_call_result(self, call_data: Dict[str, Any]) -> Optional[str]:
        """Create a new call result record"""
        try:
            with self.get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT id FROM agent_configurations WHERE is_active = true LIMIT 1")
                    active_config = cursor.fetchone()
                    agent_config_id = active_config[0] if active_config else None
                    
                    cursor.execute("""
                        INSERT INTO call_results (
                            call_id, agent_configuration_id, driver_name, phone_number, 
                            load_number, call_status, call_started_at, call_metadata
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s)
                        RETURNING id
                    """, (
                        call_data.get("call_id"),
                        agent_config_id,
                        call_data.get("driver_name"),
                        call_data.get("phone_number"),
                        call_data.get("load_number"),
                        "in_progress",
                        json.dumps(call_data.get("metadata", {}))
                    ))
                    
                    result = cursor.fetchone()
                    if result:
                        connection.commit()
                        return result[0]
                    return None
        except Exception as e:
            print(f"Error creating call result: {e}")
            return None

    async def update_call_result(self, call_id: str, update_data: Dict[str, Any]) -> bool:
        """Update call result with structured data and transcript"""
        try:
            with self.get_connection() as connection:
                with connection.cursor() as cursor:
                    set_clauses = []
                    values = []
                    
                    for field, value in update_data.items():
                        if field in ['call_status', 'call_outcome', 'driver_status', 'current_location', 
                                   'eta', 'emergency_type', 'emergency_location', 'escalation_status']:
                            set_clauses.append(f"{field} = %s")
                            values.append(value)
                        elif field in ['full_transcript', 'structured_data']:
                            set_clauses.append(f"{field} = %s")
                            values.append(json.dumps(value) if value else None)
                        elif field == 'call_ended_at':
                            set_clauses.append(f"{field} = NOW()")
                    
                    if not set_clauses:
                        return False
                    
                    set_clauses.append("updated_at = NOW()")
                    values.append(call_id)
                    
                    query = f"""
                        UPDATE call_results 
                        SET {', '.join(set_clauses)}
                        WHERE call_id = %s
                    """
                    
                    cursor.execute(query, values)
                    connection.commit()
                    
                    return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating call result: {e}")
            return False

    def get_call_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get call history with pagination"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                query = """
                SELECT 
                    id, call_id, driver_name, phone_number, load_number, 
                    call_status, call_outcome, driver_status, current_location, 
                    eta, emergency_type, emergency_location, escalation_status,
                    full_transcript, structured_data, call_metadata,
                    call_started_at, call_ended_at, created_at
                FROM call_results 
                ORDER BY created_at DESC 
                LIMIT %s
                """
                
                cursor.execute(query, (limit,))
                results = cursor.fetchall()
                
                call_history = []
                for row in results:
                    call_data = dict(row)
                    
                    # Convert datetime objects to strings and handle JSON fields
                    for key, value in call_data.items():
                        if isinstance(value, datetime):
                            call_data[key] = value.isoformat()
                        elif key in ['full_transcript', 'structured_data', 'call_metadata'] and value:
                            if isinstance(value, str):
                                try:
                                    call_data[key] = json.loads(value)
                                except json.JSONDecodeError:
                                    call_data[key] = value
                    
                    # Ensure we have proper default values
                    if not call_data.get('created_at'):
                        call_data['created_at'] = datetime.now().isoformat()
                    
                    call_history.append(call_data)
                
                return call_history
                
        except Exception as e:
            print(f"❌ Error getting call history: {e}")
            return []

    def get_call_with_tools(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get call details with tool calls and conversation history"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                query = """
                SELECT * FROM call_results 
                WHERE call_id = %s
                """
                
                cursor.execute(query, (call_id,))
                result = cursor.fetchone()
                
                if result:
                    call_data = dict(result)
                    
                    # Convert datetime objects to strings
                    for key, value in call_data.items():
                        if isinstance(value, datetime):
                            call_data[key] = value.isoformat()
                    
                    call_data['tool_calls'] = []
                    call_data['conversation_messages'] = []
                    
                    return call_data
                
                return None
                
        except Exception as e:
            print(f"❌ Error getting call with tools: {e}")
            return None

    def get_call_conversation(self, call_id: str) -> List[Dict[str, Any]]:
        """Get full conversation history for a call"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                query = """
                SELECT full_transcript FROM call_results 
                WHERE call_id = %s
                """
                
                cursor.execute(query, (call_id,))
                result = cursor.fetchone()
                
                if result and result['full_transcript']:
                    transcript = result['full_transcript']
                    if isinstance(transcript, str):
                        transcript = json.loads(transcript)
                    
                    conversation = []
                    for i, entry in enumerate(transcript):
                        conversation.append({
                            'role': entry.get('role', 'user'),
                            'content': entry.get('content', ''),
                            'sequence_number': i,
                            'timestamp': None,
                            'tool_name': None,
                            'tool_arguments': None,
                            'tool_result': None
                        })
                    
                    return conversation
                
                return []
                
        except Exception as e:
            print(f"❌ Error getting conversation: {e}")
            return []

# Global instance
_database_service = None

def get_database_service() -> DatabaseService:
    """Get or create database service instance"""
    global _database_service
    if _database_service is None:
        _database_service = DatabaseService()
    return _database_service
