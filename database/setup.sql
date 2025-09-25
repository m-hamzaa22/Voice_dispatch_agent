-- Database Setup for AI Voice Agent Tool
-- Run this script to create the necessary tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing agent configurations
CREATE TABLE IF NOT EXISTS agent_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Default Agent',
    prompts TEXT NOT NULL,
    voice_settings JSONB NOT NULL DEFAULT '{
        "temperature": 0.7,
        "speed": 1.0,
        "interruption_sensitivity": 0.8,
        "enable_backchannel": true,
        "backchannel_frequency": 0.3,
        "backchannel_words": ["mm-hmm", "I see", "okay", "right"],
        "end_call_after_silence_ms": 10000,
        "max_call_duration_ms": 300000
    }',
    retell_agent_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing call results and transcripts
CREATE TABLE IF NOT EXISTS call_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(255) UNIQUE NOT NULL,
    agent_configuration_id UUID REFERENCES agent_configurations(id),
    driver_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    load_number VARCHAR(100) NOT NULL,
    call_status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    
    -- Structured data extracted from transcript
    call_outcome VARCHAR(100),
    driver_status VARCHAR(50),
    current_location TEXT,
    eta TEXT,
    emergency_type VARCHAR(50),
    emergency_location TEXT,
    escalation_status VARCHAR(50),
    
    -- Raw data
    full_transcript JSONB,
    structured_data JSONB,
    call_metadata JSONB,
    
    -- Timestamps
    call_started_at TIMESTAMP WITH TIME ZONE,
    call_ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing call transcripts (detailed conversation log)
CREATE TABLE IF NOT EXISTS call_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_result_id UUID REFERENCES call_results(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_configurations_active ON agent_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_call_results_call_id ON call_results(call_id);
CREATE INDEX IF NOT EXISTS idx_call_results_created_at ON call_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_results_driver_name ON call_results(driver_name);
CREATE INDEX IF NOT EXISTS idx_call_results_load_number ON call_results(load_number);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_result_id ON call_transcripts(call_result_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_sequence ON call_transcripts(call_result_id, sequence_number);

-- Insert default agent configuration
INSERT INTO agent_configurations (name, prompts, is_active) VALUES (
    'Default Logistics Dispatch Agent',
    'You are a professional logistics dispatcher calling to check on a driver''s status. 

Your goal is to:
1. Greet the driver professionally
2. Ask for a status update on their current load
3. Gather key information: current location, ETA, any issues
4. Handle emergencies by escalating immediately
5. End the call professionally

Emergency triggers to watch for:
- "accident", "crash", "collision"
- "breakdown", "broken down", "engine trouble"
- "medical emergency", "sick", "injured"
- "blowout", "flat tire"
- "emergency", "urgent", "help"

If you detect an emergency, immediately:
1. Acknowledge the emergency
2. Gather location and emergency type
3. Tell them a human dispatcher will call back immediately
4. End the call quickly

Be professional, concise, and empathetic.',
    true
) ON CONFLICT DO NOTHING;
