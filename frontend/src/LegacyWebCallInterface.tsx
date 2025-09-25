import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { Box, Typography, Button, Card, CardContent, Alert, Chip, CircularProgress } from '@mui/material';
import { PhoneDisabled, Mic, VolumeUp, Phone, Error as ErrorIcon, Info } from '@mui/icons-material';

interface WebCallInterfaceProps {
  accessToken: string;
  onCallEnd: () => void;
}

const WebCallInterface: React.FC<WebCallInterfaceProps> = ({ accessToken, onCallEnd }) => {
  const retellWebClient = useRef<RetellWebClient | null>(null);
  const [callStatus, setCallStatus] = useState<string>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [connectionDetails, setConnectionDetails] = useState<string>('Preparing call...');
  const [callStarted, setCallStarted] = useState<boolean>(false);

  const startWebCall = useCallback(async () => {
    try {
      console.log("Starting Retell Web Call");
      
      setCallStatus('requesting-permissions');
      setConnectionDetails('Requesting microphone access...');
      setError(null);

      // Request microphone permission with timeout
      try {
        console.log("🎤 Requesting microphone permission...");
        
        const permissionPromise = navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        
        // Add timeout to prevent infinite hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Microphone permission timeout')), 10000);
        });
        
        const stream = await Promise.race([permissionPromise, timeoutPromise]) as MediaStream;
        
        console.log("✅ Microphone permission granted");
        setConnectionDetails('Microphone access granted');
        
        // Stop the test stream - Retell will handle the actual audio
        stream.getTracks().forEach(track => track.stop());
        
      } catch (permissionError: any) {
        console.error("❌ Microphone permission failed:", permissionError);
        
        let errorMsg = "Microphone access required.";
        if (permissionError.message?.includes('timeout')) {
          errorMsg = "Microphone permission timed out. Please refresh and allow microphone access.";
        } else if (permissionError.name === 'NotAllowedError') {
          errorMsg = "Microphone access denied. Please click the microphone icon in your browser and allow access.";
        } else if (permissionError.name === 'NotFoundError') {
          errorMsg = "No microphone found. Please check your audio devices.";
        }
        
        setError(errorMsg);
        setCallStatus('error');
        return;
      }

      // Initialize Retell Web Client
      setCallStatus('connecting');
      setConnectionDetails('Connecting to voice service...');
      
      // Clean up existing client
      if (retellWebClient.current) {
        try {
          retellWebClient.current.stopCall();
        } catch (e) {
          console.warn("Cleanup warning:", e);
        }
      }
      
      retellWebClient.current = new RetellWebClient();
      console.log("Retell Web Client initialized");

      // Set up event listeners
      retellWebClient.current.on("call_started", () => {
        console.log("Call started - audio should be working");
        setCallStatus('active');
        setCallStarted(true);
        setError(null);
        setConnectionDetails('Call active - conversation ready');
      });

      retellWebClient.current.on("call_ended", () => {
        console.log("Call ended");
        setCallStatus('ended');
        setCallStarted(false);
        setConnectionDetails('Call ended');
        onCallEnd?.();
      });

      retellWebClient.current.on("error", (error: any) => {
        console.error("Retell error:", error);
        
        let errorMessage = 'Call error occurred';
        if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        // Handle common errors
        if (errorMessage.includes('access_token')) {
          errorMessage = 'Invalid access token. Please refresh and try again.';
        } else if (errorMessage.includes('WebRTC') || errorMessage.includes('connection')) {
          errorMessage = 'Connection failed. Check your internet connection.';
        } else if (errorMessage.includes('microphone')) {
          errorMessage = 'Microphone access issue. Check browser permissions.';
        }
        
        setError(errorMessage);
        setCallStatus('error');
        setConnectionDetails(`Error: ${errorMessage}`);
      });

      // Audio state events - these are crucial for UI feedback
      retellWebClient.current.on("agent_start_talking", () => {
        console.log("Agent started speaking - you should hear audio now");
        setIsAgentSpeaking(true);
        setIsUserSpeaking(false);
        setConnectionDetails('Agent is speaking');
      });

      retellWebClient.current.on("agent_stop_talking", () => {
        console.log("Agent stopped speaking");
        setIsAgentSpeaking(false);
        setConnectionDetails('Your turn to speak');
      });

      retellWebClient.current.on("user_start_talking", () => {
        console.log("User started speaking");
        setIsUserSpeaking(true);
        setIsAgentSpeaking(false);
        setConnectionDetails('You are speaking');
      });

      retellWebClient.current.on("user_stop_talking", () => {
        console.log("User stopped speaking");
        setIsUserSpeaking(false);
        setConnectionDetails('Processing...');
      });

      // Handle real-time updates safely
      retellWebClient.current.on("update", (update: any) => {
        console.log("📝 Real-time update:", update);
        // Don't try to render objects directly
      });

      // Start the call
      setConnectionDetails('Starting call...');
      console.log("Starting call with access token");

      const callConfig = {
        accessToken: accessToken,
        sampleRate: 24000,
        enableUpdate: true,
      };

      await retellWebClient.current.startCall(callConfig);
      console.log("Call start request sent");

    } catch (error: any) {
      console.error("Failed to start call:", error);
      
      let errorMessage = error?.message || 'Failed to start call';
      
      if (errorMessage.includes('NetworkError')) {
        errorMessage = 'Network connection failed. Check your internet connection.';
      } else if (errorMessage.includes('NotAllowedError')) {
        errorMessage = 'Microphone access denied. Please allow microphone access.';
      } else if (errorMessage.includes('NotFoundError')) {
        errorMessage = 'No microphone found. Check your audio devices.';
      }
      
      setError(errorMessage);
      setCallStatus('error');
      setConnectionDetails(`Failed: ${errorMessage}`);
    }
  }, [accessToken, onCallEnd]);

  // Start call when component mounts
  useEffect(() => {
    if (accessToken && !callStarted && callStatus !== 'active') {
      startWebCall();
    }

    return () => {
      console.log("Cleaning up WebCallInterface");
      if (retellWebClient.current) {
        try {
          retellWebClient.current.stopCall();
          retellWebClient.current = null;
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
      }
    };
  }, [accessToken, startWebCall, callStarted, callStatus]);

  const endCall = useCallback(() => {
    console.log("User ending call");
    if (retellWebClient.current) {
      try {
        retellWebClient.current.stopCall();
        setCallStatus('ended');
        setCallStarted(false);
        onCallEnd();
      } catch (error) {
        console.error("Error ending call:", error);
        onCallEnd();
      }
    } else {
      onCallEnd();
    }
  }, [onCallEnd]);

  const retryCall = useCallback(() => {
    console.log("Retrying call");
    setError(null);
    setCallStatus('initializing');
    setCallStarted(false);
    
    if (retellWebClient.current) {
      try {
        retellWebClient.current.stopCall();
        retellWebClient.current = null;
      } catch (e) {
        console.warn("Cleanup warning during retry:", e);
      }
    }
    
    setTimeout(() => {
      startWebCall();
    }, 1000);
  }, [startWebCall]);

  const getStatusColor = () => {
    switch (callStatus) {
      case 'active': return 'success';
      case 'error': return 'error';
      case 'ended': return 'default';
      default: return 'warning';
    }
  };

  const getStatusIcon = () => {
    if (callStatus === 'active') {
      if (isAgentSpeaking) return <VolumeUp />;
      if (isUserSpeaking) return <Mic />;
      return <Phone />;
    }
    if (callStatus === 'error') return <ErrorIcon />;
    if (callStatus === 'connecting' || callStatus === 'initializing' || callStatus === 'requesting-permissions') {
      return <CircularProgress size={16} />;
    }
    return <Phone />;
  };

  const formatStatus = (status: string) => {
    return status
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card sx={{ m: 3 }}>
      <CardContent>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            🚨 UPDATED COMPONENT - TESTING VERSION 2.0 🚨
          </Typography>
          
          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {/* Status Display */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              icon={getStatusIcon()}
              label={formatStatus(callStatus)} 
              color={getStatusColor()}
              sx={{ fontSize: '1rem', p: 2 }}
            />
            
            {/* Speaking Status */}
            {callStatus === 'active' && (
              <>
                {isAgentSpeaking && (
                  <Chip 
                    icon={<VolumeUp />}
                    label="Agent Speaking"
                    color="info"
                    variant="outlined"
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
                
                {!isAgentSpeaking && !isUserSpeaking && (
                  <Chip 
                    icon={<Phone />}
                    label="Ready"
                    color="default"
                    variant="outlined"
                  />
                )}
              </>
            )}
          </Box>
          
          {/* Connection Details */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            {connectionDetails}
          </Typography>
          
          {/* Instructions for Active Call */}
          {callStatus === 'active' && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#f0f8ff', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>📞 Call is Live</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                • Speak naturally into your microphone
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                • Listen through your speakers or headphones
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                • The AI agent will respond to your questions
              </Typography>
            </Box>
          )}

          {/* Microphone Permission Help */}
          {error && error.includes('microphone') && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Microphone Access Required
              </Typography>
              <Typography variant="body2" component="div" sx={{ textAlign: 'left', mt: 1 }}>
                1. Look for the microphone icon in your browser's address bar
                <br />2. Click "Allow" to grant microphone access
                <br />3. Refresh the page and try again
              </Typography>
            </Alert>
          )}
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {callStatus === 'error' && (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={retryCall}
                size="large"
                sx={{ minWidth: 200 }}
              >
                Try Again
              </Button>
            )}
            
            <Button 
              variant="contained" 
              color="error" 
              startIcon={<PhoneDisabled />}
              onClick={endCall}
              disabled={callStatus === 'ended'}
              size="large"
              sx={{ minWidth: 200 }}
            >
              {callStatus === 'ended' ? 'Call Ended' : 'End Call'}
            </Button>
          </Box>
          
          {/* Development Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace', textAlign: 'left' }}>
                Status: {callStatus} | Started: {callStarted ? 'Yes' : 'No'}
                <br />Agent Speaking: {isAgentSpeaking ? 'Yes' : 'No'} | User Speaking: {isUserSpeaking ? 'Yes' : 'No'}
                <br />Client: {retellWebClient.current ? 'Initialized' : 'Null'}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default WebCallInterface;