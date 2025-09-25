# AI Voice Agent Tool for Logistics Dispatch

A production-ready web application that enables administrators to configure, test, and review calls made by an adaptive AI voice agent for logistics dispatch operations. Built with FastAPI, React, and Retell AI integration.

## 🎯 What This Application Does

This tool allows logistics administrators to:
- **Configure AI Voice Agents**: Define conversation prompts and voice settings through a web interface
- **Trigger Phone Calls**: Make real phone calls to drivers using Retell AI
- **Test with Web Calls**: Test conversations through web browser before making actual calls
- **Review Call Results**: View complete conversation transcripts and extracted structured data
- **Handle Emergency Scenarios**: Automatically detect and escalate emergency situations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │   Retell AI     │
│   (Port 3000)    │◄──►│   (Port 8005)    │◄──►│   Voice Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Supabase/PostgreSQL │    │   OpenAI GPT    │
                       │   Database      │    │   LLM Service   │
                       └─────────────────┘    └─────────────────┘
```

## 🛠 Technology Stack

- **Backend**: FastAPI (Python) with WebSocket support
- **Frontend**: React 19 with TypeScript and Material-UI
- **Database**: PostgreSQL (via Supabase or direct connection using psycopg2)
- **AI Voice**: Retell AI with custom LLM WebSocket integration
- **LLM**: OpenAI GPT-4 for intelligent conversation handling
- **Real-time Communication**: WebSocket for live conversation processing

## 📁 Project Structure

```
ai-voice-agent/
├── app/                          # FastAPI Backend
│   ├── main.py                   # Application entry point
│   ├── core/config.py            # Configuration management
│   ├── api/v1/
│   │   ├── api.py                # API router
│   │   └── endpoints/
│   │       ├── agents.py         # Agent configuration endpoints
│   │       ├── calls.py          # Call management endpoints
│   │       └── websocket.py      # Real-time LLM WebSocket
│   ├── models/schemas.py         # Pydantic data models
│   └── services/database.py     # Database service (psycopg2)
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── App.tsx              # Main application with 4 tabs
│   │   ├── WebCallInterface.tsx # Web-based call testing
│   │   └── components/
├── database/setup.sql           # PostgreSQL schema setup
├── requirements.txt             # Python dependencies
├── env.example                  # Environment variables template
├── run.py                      # Development server launcher
└── start-dev.sh               # Development startup script
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **Supabase Account** OR **PostgreSQL Database**
- **API Keys**: Retell AI, OpenAI

### 1. Clone Repository

```bash
git clone <repository-url>
cd ai-voice-agent
```

### 2. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your actual credentials
```

**Essential Environment Variables:**
```env
# Retell AI Configuration
RETELL_API_KEY=your_retell_api_key_here
RETELL_AGENT_ID=your_retell_agent_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
HOST=0.0.0.0
PORT=8005

# Webhook Configuration (use ngrok/cloudflare tunnel for local testing)
WEBHOOK_URL=https://your-tunnel-domain.com/webhook
LLM_WEBSOCKET_URL=wss://your-tunnel-domain.com/llm-websocket

# Database Configuration (PostgreSQL connection)
user=your_db_user
password=your_db_password
host=your_db_host
port=5432
dbname=your_database_name
```

### 3. Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database (run SQL in your Supabase SQL editor or PostgreSQL)
# Copy contents of database/setup.sql and execute
```

### 4. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

### 5. Start Application

```bash
# Option 1: Use startup script (starts both backend and frontend)
chmod +x start-dev.sh
./start-dev.sh

# Option 2: Start manually
# Terminal 1 - Backend
source venv/bin/activate
python run.py

# Terminal 2 - Frontend
cd frontend
npm start
```

**Access Points:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8005
- **API Documentation**: http://localhost:8005/docs

## 📱 Application Features

### Dashboard Tabs

1. **Agent Configuration**: Configure AI prompts and voice settings
2. **Phone Calls**: Trigger real phone calls to drivers
3. **Web Call Testing**: Test conversations in browser before live calls
4. **Call Analytics**: Review call history, transcripts, and extracted data

### Call Scenarios Supported

**Routine Check-ins:**
- Driver status updates
- Location and ETA collection
- Load progress tracking

**Emergency Detection:**
- Automatic detection of emergency keywords
- Immediate escalation protocol
- Critical information gathering

**Structured Data Extraction:**
- `call_outcome`: "In-Transit Update" | "Arrival Confirmation" | "Emergency Detected"
- `driver_status`: "Driving" | "Delayed" | "Arrived"
- `current_location`: GPS or descriptive location
- `eta`: Estimated time of arrival
- `emergency_type`: "Accident" | "Breakdown" | "Medical" | "Other"
- `emergency_location`: Exact emergency location

## 📡 API Endpoints

### Agent Management
- `GET /agent-config` - Get active agent configuration
- `POST /agent-config` - Save agent configuration  
- `GET /agent-configs` - Get all configurations (available but unused by frontend)
- `POST /create` - Create Retell AI agent (available but unused by frontend)

### Call Management  
- `POST /trigger-call` - Trigger phone call
- `POST /create-test-call` - Create web call for testing
- `GET /call-history` - Get call history
- `GET /call-details/{call_id}` - Get call details (available but unused by frontend)
- `POST /recording-webhook` - Retell AI webhook for call completion

### WebSocket
- `WS /llm-websocket/{call_id}` - Real-time conversation handling

### System
- `GET /health` - Health check endpoint

## 🗃️ Database Schema

The application uses PostgreSQL with three main tables:

### agent_configurations
```sql
- id (UUID, Primary Key)
- name (VARCHAR) - Agent name
- prompts (TEXT) - Conversation prompts
- voice_settings (JSONB) - Voice configuration
- retell_agent_id (VARCHAR) - Retell AI agent ID
- is_active (BOOLEAN) - Active status
- created_at, updated_at (TIMESTAMP)
```

### call_results
```sql
- id (UUID, Primary Key)
- call_id (VARCHAR, Unique) - Retell call identifier
- driver_name, phone_number, load_number (VARCHAR)
- call_status (VARCHAR) - "in_progress" | "completed" | "failed"
- call_outcome, driver_status, current_location, eta (VARCHAR/TEXT)
- emergency_type, emergency_location, escalation_status (VARCHAR/TEXT)
- full_transcript (JSONB) - Complete conversation
- structured_data (JSONB) - Extracted data
- call_metadata (JSONB) - Additional metadata
- call_started_at, call_ended_at, created_at, updated_at (TIMESTAMP)
```

### call_transcripts
```sql
- id (UUID, Primary Key)
- call_result_id (UUID, Foreign Key)
- sequence_number (INTEGER) - Message order
- role (VARCHAR) - "user" | "agent"
- content (TEXT) - Message content
- timestamp, metadata (TIMESTAMP, JSONB)
```

## 🔧 Configuration

### Retell AI Setup

1. **Create Account**: Sign up at [Retell AI](https://retellai.com)
2. **Get API Key**: From your dashboard
3. **Create Agent**: Use `/api/v1/agents/create` endpoint or dashboard
4. **Configure Webhook**: Set to `https://your-domain.com/llm-websocket/{call_id}`

### Voice Settings

The application uses optimized voice settings:
```json
{
  "temperature": 0.7,
  "speed": 1.0,
  "interruption_sensitivity": 0.8,
  "enable_backchannel": true,
  "backchannel_frequency": 0.3,
  "backchannel_words": ["mm-hmm", "I see", "okay", "right"],
  "end_call_after_silence_ms": 10000,
  "max_call_duration_ms": 300000
}
```

## 🚀 Deployment

### Production Setup

1. **Environment**: Set `DEBUG=false` in production
2. **Database**: Use Supabase or managed PostgreSQL
3. **SSL**: Configure HTTPS for webhook endpoints
4. **Domain**: Set proper webhook URLs in environment
5. **Process Management**: Use PM2 or similar

### Security Notes

- All API keys are loaded from environment variables
- Database uses connection pooling with psycopg2
- CORS is configured for allowed origins
- No secrets are hardcoded in the application

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify Supabase URL and key in `.env`
- Check if database tables exist (run `database/setup.sql`)
- Ensure psycopg2-binary is installed

**WebSocket Connection Failed:**
- Check backend is running on port 8005
- Verify WebSocket URL format in environment
- Ensure firewall allows WebSocket connections

**Retell AI Call Issues:**
- Verify API key and agent ID are correct
- Check phone number format (+1XXXXXXXXXX)
- Ensure webhook URL is publicly accessible
- Verify Retell account has sufficient balance

**Frontend API Connection:**
- Check `REACT_APP_API_BASE_URL` environment variable
- Verify backend CORS settings include frontend URL
- Check network connectivity between frontend and backend

## 📚 Dependencies

### Backend (Python)
- FastAPI 0.104.1 - Web framework
- psycopg2-binary 2.9.9 - PostgreSQL adapter
- retell-sdk 4.48.0 - Retell AI integration
- openai 1.3.7 - OpenAI API client
- websockets 12.0 - WebSocket support

### Frontend (React)
- React 19.1.1 - UI framework
- Material-UI 7.3.2 - UI components
- retell-client-js-sdk 2.0.5 - Retell web client
- axios 1.12.2 - HTTP client
- TypeScript 4.9.5 - Type safety

## 📄 License

This project implements a production-ready AI voice agent system for logistics dispatch operations with real-time conversation handling and intelligent data extraction capabilities.

---

**Note**: This application is designed for production use. Ensure proper security measures, monitoring, and backup strategies are implemented for production deployment.
