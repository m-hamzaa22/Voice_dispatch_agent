import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { Box, Typography, Button, Card, CardContent, Alert, Chip, CircularProgress, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { PhoneDisabled, Mic, VolumeUp, Phone, Error as ErrorIcon, Wifi, PlayArrow } from '@mui/icons-material';

interface WebCallInterfaceProps {
  // Your backend endpoint that creates access tokens
  apiBaseUrl: string;
  // Agent ID to use for the call
  agentId: string;
  // Optional: Custom call data
  callData?: {
    driver_name?: string;
    phone_number?: string;
    load_number?: string;
  };
  // External trigger to start call (for form integration)
  shouldStartCall?: boolean;
  // Callback when call starts/ends
  onCallStatusChange?: (status: string) => void;
}

const WebCallInterface: React.FC<WebCallInterfaceProps> = ({ 
  apiBaseUrl, 
  agentId, 
  callData,
  shouldStartCall = false,
  onCallStatusChange
}) => {
  const retellWebClient = useRef<RetellWebClient | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'creating' | 'connecting' | 'active' | 'ended' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  // Audio state tracking from Retell events
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  // Real-time call data
  const [transcript, setTranscript] = useState<string>('');
  const [callMetadata, setCallMetadata] = useState<any>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  
  // Audio device management
  const [availableDevices, setAvailableDevices] = useState<{
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  }>({ microphones: [], speakers: [] });
  const [selectedMic, setSelectedMic] = useState<string>('default');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('default');

  // Get available audio devices
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter(device => device.kind === 'audioinput');
        const speakers = devices.filter(device => device.kind === 'audiooutput');
        
        setAvailableDevices({ microphones, speakers });
      } catch (err) {
        console.warn('Failed to enumerate devices:', err);
      }
    };

    getAudioDevices();
  }, []);

  // Create access token from your backend
  const createAccessToken = useCallback(async () => {
    try {
      console.log('📝 Creating access token with data:', callData);
      const response = await fetch(`${apiBaseUrl}/create-test-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...callData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create access token: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Access token created successfully');
      
      // Store the call ID for cleanup later
      if (data.call_id) {
        setCurrentCallId(data.call_id);
        console.log(`📋 Stored call ID for cleanup: ${data.call_id}`);
      }
      
      return data.access_token;
    } catch (error: any) {
      console.error('❌ Backend error creating access token:', error);
      throw new Error(`Backend error: ${error.message}`);
    }
  }, [apiBaseUrl, callData]);

  // Start the voice call
  const startCall = useCallback(async () => {
    try {
      console.log("🚀 Starting Retell voice call");
      
      // Check microphone permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
        console.log("✅ Microphone permission granted");
      } catch (micError) {
        console.error("❌ Microphone permission denied:", micError);
        setError("Microphone access is required for voice calls. Please allow microphone access and try again.");
        return;
      }
      
      setCallStatus('creating');
      setError(null);
      setTranscript('');
      setCallMetadata(null);

      // Step 1: Get access token from your backend
      console.log("📝 Creating access token...");
      const accessToken = await createAccessToken();
      console.log("✅ Access token created");

      // Step 2: Initialize Retell Web Client
      setCallStatus('connecting');
      console.log("🔧 Initializing RetellWebClient");
      
      if (retellWebClient.current) {
        retellWebClient.current.stopCall();
      }
      
      // Initialize with proper constructor
      retellWebClient.current = new RetellWebClient();

      // Step 3: Set up all event listeners BEFORE starting call
      console.log("📡 Setting up event listeners");

      // Call lifecycle events
      retellWebClient.current.on("call_started", () => {
        console.log("✅ Call started - WebRTC connected");
        setCallStatus('active');
        setError(null);
      });

      retellWebClient.current.on("call_ended", async () => {
        console.log("📞 Call ended");
        setCallStatus('ended');
        setIsAgentSpeaking(false);
        setIsUserSpeaking(false);
        
        // Note: Call cleanup is handled by the backend automatically
        // when the call recording webhook is received from Retell
        console.log("📞 Call ended - cleanup will be handled by backend webhook");
      });

      retellWebClient.current.on("error", (error: any) => {
        console.error("❌ Retell error:", error);
        setError(`Call error: ${error?.message || 'Unknown error'}`);
        setCallStatus('error');
      });

      // Audio state events - THESE ARE CRUCIAL FOR UI FEEDBACK
      retellWebClient.current.on("agent_start_talking", () => {
        console.log("🔊 Agent started speaking");
        setIsAgentSpeaking(true);
        setIsUserSpeaking(false);
      });

      retellWebClient.current.on("agent_stop_talking", () => {
        console.log("🔇 Agent stopped speaking");
        setIsAgentSpeaking(false);
      });

      retellWebClient.current.on("user_start_talking", () => {
        console.log("🎤 User started speaking");
        setIsUserSpeaking(true);
        setIsAgentSpeaking(false);
      });

      retellWebClient.current.on("user_stop_talking", () => {
        console.log("🤐 User stopped speaking");
        setIsUserSpeaking(false);
      });

      // Real-time transcript and data
      retellWebClient.current.on("update", (update: any) => {
        console.log("📝 Real-time update:", update);
        if (update?.transcript && Array.isArray(update.transcript)) {
          // Convert transcript array to readable string
          const transcriptText = update.transcript
            .map((item: any) => `${item.role}: ${item.content}`)
            .join('\n');
          setTranscript(transcriptText);
        }
      });

      // Custom metadata from your LLM
      retellWebClient.current.on("metadata", (metadata: any) => {
        console.log("📋 Call metadata:", metadata);
        setCallMetadata(metadata);
      });

      // Raw audio data (if enabled) - CRITICAL for voice detection
      retellWebClient.current.on("audio", (audioData: Float32Array) => {
        // console.log("🎵 Raw audio data received:", audioData.length, "samples");
        // This ensures the audio stream is properly processed for voice detection
      });

      // Connection events
      retellWebClient.current.on("connect", () => {
        console.log("🔗 WebSocket connected");
      });

      retellWebClient.current.on("disconnect", (reason: any) => {
        console.log("🔌 WebSocket disconnected:", reason);
        console.log("🔍 Call status when disconnected:", callStatus);
        console.log("🔍 Component still mounted:", retellWebClient.current !== null);
      });

      // Step 4: Start the call with proper configuration
      console.log("🎯 Starting call with access token");
      
      const callConfig = {
        accessToken: accessToken,
        // Audio configuration
        sampleRate: 24000, // 24kHz recommended by Retell
        captureDeviceId: selectedMic,
        playbackDeviceId: selectedSpeaker,
        // Enable real-time features
        emitRawAudioSamples: true, // Get raw audio for visualization
      };

      console.log("📊 Call configuration:", {
        sampleRate: callConfig.sampleRate,
        captureDevice: selectedMic,
        playbackDevice: selectedSpeaker,
      });

      await retellWebClient.current.startCall(callConfig);
      console.log("✅ Call initiated successfully");

    } catch (error: any) {
      console.error("❌ Failed to start call:", error);
      setError(error.message);
      setCallStatus('error');
    }
  }, [createAccessToken, selectedMic, selectedSpeaker]);

  // End the call
  const endCall = useCallback(async () => {
    console.log("👤 User ending call");
    if (retellWebClient.current) {
      retellWebClient.current.stopCall();
      setCallStatus('ended');
      
      // Note: Call cleanup is handled by the backend automatically
      console.log("👤 User ended call - cleanup will be handled by backend webhook");
    }
  }, [currentCallId, apiBaseUrl]);

  // Handle external trigger (from form) - only run when shouldStartCall changes
  useEffect(() => {
    if (shouldStartCall && callStatus === 'idle') {
      console.log("🎯 External trigger received - starting call from form");
      startCall();
    }
  }, [shouldStartCall, callStatus, startCall]);

  // Notify parent of status changes
  useEffect(() => {
    if (onCallStatusChange) {
      onCallStatusChange(callStatus);
    }
  }, [callStatus]); // Removed onCallStatusChange to prevent unnecessary re-renders

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up RetellWebClient - component unmounting");
      console.log("🔍 Call status during cleanup:", callStatus);
      if (retellWebClient.current) {
        console.log("🛑 Stopping call due to component unmount");
        retellWebClient.current.stopCall();
        retellWebClient.current = null;
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (callStatus) {
      case 'active': return 'success';
      case 'error': return 'error';
      case 'ended': return 'default';
      case 'creating':
      case 'connecting':
        return 'warning';
      default: return 'info';
    }
  };

  const getStatusIcon = () => {
    if (callStatus === 'active') {
      if (isAgentSpeaking) return <VolumeUp />;
      if (isUserSpeaking) return <Mic />;
      return <Phone />;
    }
    if (callStatus === 'error') return <ErrorIcon />;
    if (callStatus === 'creating' || callStatus === 'connecting') {
      return <CircularProgress size={20} />;
    }
    return <Wifi />;
  };

  return (
    <Card sx={{ 
      m: 3, 
      maxWidth: 900, 
      mx: 'auto',
      borderRadius: 3,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      border: '1px solid',
      borderColor: 'grey.200',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
          🎙️ Retell AI Voice Agent
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Official SDK Implementation with WebRTC Audio
        </Typography>
      </Box>
      <CardContent sx={{ p: 4 }}>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Call Error
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          </Alert>
        )}

        {/* Call Status */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip 
              icon={getStatusIcon()}
              label={callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
              color={getStatusColor()}
              sx={{ fontSize: '1rem', p: 2 }}
            />

            {/* Speaking indicators */}
            {callStatus === 'active' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {isAgentSpeaking && (
                  <Chip 
                    icon={<VolumeUp />}
                    label="Agent Speaking"
                    color="info"
                    variant="outlined"
                    size="small"
                    sx={{ 
                      animation: 'pulse 1s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                        '100%': { opacity: 1 }
                      }
                    }}
                  />
                )}
                {isUserSpeaking && (
                  <Chip 
                    icon={<Mic />}
                    label="You're Speaking"
                    color="success"
                    variant="outlined"
                    size="small"
                    sx={{ 
                      animation: 'pulse 1s infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                        '100%': { opacity: 1 }
                      }
                    }}
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Device Selection (when not active) */}
        {callStatus === 'idle' && availableDevices.microphones.length > 0 && (
          <Box sx={{ mb: 4, p: 3, backgroundColor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Audio Devices
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Microphone</InputLabel>
                <Select 
                  value={selectedMic} 
                  onChange={(e) => setSelectedMic(e.target.value)}
                  label="Microphone"
                >
                  <MenuItem value="default">Default Microphone</MenuItem>
                  {availableDevices.microphones.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Speaker</InputLabel>
                <Select 
                  value={selectedSpeaker} 
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                  label="Speaker"
                >
                  <MenuItem value="default">Default Speaker</MenuItem>
                  {availableDevices.speakers.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}

        {/* Call Controls */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          {callStatus === 'idle' && (
            <Button
              onClick={startCall}
              variant="contained"
              color="success"
              size="large"
              startIcon={<PlayArrow />}
              sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
            >
              Start Voice Call
            </Button>
          )}

          {(callStatus === 'active' || callStatus === 'connecting' || callStatus === 'creating') && (
            <Button
              onClick={endCall}
              variant="contained"
              color="error"
              size="large"
              startIcon={<PhoneDisabled />}
              sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
            >
              End Call
            </Button>
          )}

          {callStatus === 'error' && (
            <Button
              onClick={startCall}
              variant="contained"
              color="primary"
              size="large"
              sx={{ px: 4, py: 2, fontSize: '1.1rem' }}
            >
              Try Again
            </Button>
          )}
        </Box>

        {/* Real-time Transcript */}
        {transcript && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Live Transcript
            </Typography>
            <Box sx={{ 
              p: 3, 
              backgroundColor: 'grey.50', 
              borderRadius: 2, 
              border: 1, 
              borderColor: 'grey.200',
              minHeight: 96, 
              maxHeight: 192, 
              overflowY: 'auto' 
            }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {transcript || "Transcript will appear here during the call..."}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Call Metadata */}
        {callMetadata && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Call Data
            </Typography>
            <Box sx={{ 
              p: 3, 
              backgroundColor: 'blue.50', 
              borderRadius: 2, 
              border: 1, 
              borderColor: 'blue.200' 
            }}>
              <Typography variant="body2" component="pre" sx={{ 
                overflow: 'auto', 
                fontSize: '0.875rem',
                fontFamily: 'monospace' 
              }}>
                {JSON.stringify(callMetadata, null, 2)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            How This Works
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5 } }}>
            <li><strong>Backend Security:</strong> Access tokens created securely on your server</li>
            <li><strong>WebRTC Audio:</strong> Direct browser-to-Retell audio streaming</li>
            <li><strong>Real-time Events:</strong> Live transcript, speaking detection, metadata</li>
            <li><strong>Device Control:</strong> Select specific microphones and speakers</li>
            <li><strong>Official SDK:</strong> Uses Retell's retell-client-js-sdk v2.0.5</li>
          </Box>
        </Alert>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
            <div>Status: {callStatus}</div>
            <div>Agent Speaking: {isAgentSpeaking ? 'Yes' : 'No'}</div>
            <div>User Speaking: {isUserSpeaking ? 'Yes' : 'No'}</div>
            <div>Client: {retellWebClient.current ? 'Initialized' : 'Null'}</div>
            <div>Transcript Length: {transcript.length} chars</div>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WebCallInterface;
