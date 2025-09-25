"""
Application Configuration
Streamlined configuration for AI Voice Agent Tool
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Retell AI Configuration
    RETELL_API_KEY = os.getenv("RETELL_API_KEY")
    RETELL_AGENT_ID = os.getenv("RETELL_AGENT_ID")
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    
    # Database Configuration (PostgreSQL via psycopg2)
    DB_USER = os.getenv("user", "postgres")
    DB_PASSWORD = os.getenv("password")
    DB_HOST = os.getenv("host")
    DB_PORT = os.getenv("port", "5432")
    DB_NAME = os.getenv("dbname", "postgres")
    
    # Server Configuration
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8005))
    
    # Webhook Configuration
    WEBHOOK_URL = os.getenv("WEBHOOK_URL")
    LLM_WEBSOCKET_URL = os.getenv("LLM_WEBSOCKET_URL")
    
    # Application Settings
    PROJECT_NAME = "AI Voice Agent Tool"
    VERSION = "1.0.0"
    DEBUG = True
    ALLOWED_HOSTS = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]

# Global settings instance
settings = Config()
