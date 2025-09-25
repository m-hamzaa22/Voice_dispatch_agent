import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  AppBar,
  Toolbar,
  Divider,
  Fade,
  Grow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Phone,
  Settings,
  History,
  PlayArrow,
  CheckCircle,
  Error,
  Info,
  Dashboard,
  Mic,
  VoiceChat,
  Analytics,
  Refresh,
  Save,
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import axios from 'axios';
import LegacyWebCallInterface from './LegacyWebCallInterface';
import WebCallInterface from './WebCallInterface';
import LoadingSpinner from './components/LoadingSpinner';

// Types
interface CallRequest {
  driver_name: string;
  phone_number: string;
  load_number: string;
}

interface CallResult {
  id: string;
  timestamp: string;
  driver_name: string;
  phone_number: string;
  load_number: string;
  status: 'completed' | 'failed' | 'in_progress';
  call_outcome?: string;
  driver_status?: string;
  current_location?: string;
  eta?: string;
  emergency_type?: string;
  emergency_location?: string;
  escalation_status?: string;
  transcript?: string;
  structured_data?: any;
}

interface AgentConfig {
  prompts: string;
  voice_settings: {
    temperature: number;
    speed: number;
    interruption_sensitivity: number;
  };
}

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8005';

function App() {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [callRequest, setCallRequest] = useState<CallRequest>({
    driver_name: '',
    phone_number: '',
    load_number: '',
  });
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    prompts: `Loading agent configuration...`,
    voice_settings: {
      temperature: 0.7,
      speed: 1.0,
      interruption_sensitivity: 0.8,
    },
  });
  const [callHistory, setCallHistory] = useState<CallResult[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeWebCall, setActiveWebCall] = useState<string | null>(null);
  const [triggerNewWebCall, setTriggerNewWebCall] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Memoized call data for the main form
  const formCallData = useMemo(() => ({
    driver_name: callRequest.driver_name,
    phone_number: callRequest.phone_number,
    load_number: callRequest.load_number,
  }), [callRequest.driver_name, callRequest.phone_number, callRequest.load_number]);

  // Memoized call data for quick test
  const quickTestCallData = useMemo(() => ({
    driver_name: 'Test Driver',
    phone_number: '+1234567890',
    load_number: 'TEST-001',
  }), []);

  // Load agent config only on component mount (call history loaded on demand)
  useEffect(() => {
    loadAgentConfig();
  }, []); // Only run once on mount

  const loadCallHistory = async () => {
    if (isLoadingHistory) return; // Prevent multiple simultaneous calls
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/call-history`);
      if (response.data.success) {
        // Transform the data to match our interface
        const transformedCalls = response.data.calls.map((call: any) => {
          // Handle transcript parsing safely
          let transcript = undefined;
          if (call.full_transcript) {
            try {
              const transcriptData = typeof call.full_transcript === 'string' 
                ? JSON.parse(call.full_transcript) 
                : call.full_transcript;
              
              if (Array.isArray(transcriptData)) {
                transcript = transcriptData
                  .map((t: any) => `${t.role || 'unknown'}: ${t.content || ''}`)
                  .join('\n\n');
              }
            } catch (error) {
              console.warn('Failed to parse transcript for call:', call.call_id, error);
              transcript = 'Transcript parsing error';
            }
          }

          // Handle timestamp parsing safely
          let timestamp = new Date().toISOString();
          if (call.created_at) {
            try {
              // Parse the timestamp - handle both ISO strings and other formats
              const parsedDate = new Date(call.created_at);
              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.toISOString();
              }
            } catch (error) {
              console.warn('Failed to parse timestamp:', call.created_at, error);
            }
          }

          // Handle structured_data parsing safely
          let structured_data = null;
          if (call.structured_data) {
            try {
              structured_data = typeof call.structured_data === 'string' 
                ? JSON.parse(call.structured_data) 
                : call.structured_data;
            } catch (error) {
              console.warn('Failed to parse structured_data for call:', call.call_id, error);
              structured_data = { parsing_error: 'Failed to parse structured data', raw_data: call.structured_data };
            }
          }

          return {
            id: call.id || call.call_id,
            timestamp,
            driver_name: call.driver_name || 'Unknown',
            phone_number: call.phone_number || 'N/A',
            load_number: call.load_number || 'N/A',
            status: call.call_status || 'unknown',
            call_outcome: call.call_outcome || null,
            driver_status: call.driver_status || null,
            current_location: call.current_location || null,
            eta: call.eta || null,
            emergency_type: call.emergency_type || null,
            emergency_location: call.emergency_location || null,
            escalation_status: call.escalation_status || null,
            transcript,
            structured_data,
          };
        });
        setCallHistory(transformedCalls);
      }
    } catch (error) {
      console.error('Failed to load call history:', error);
      // Fallback to mock data if backend is not available
      const mockHistory: CallResult[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          driver_name: 'Mike Johnson',
          phone_number: '+1234567890',
          load_number: '7891-B',
          status: 'completed',
          call_outcome: 'In-Transit Update',
          driver_status: 'Driving',
          current_location: 'I-10 near Indio, CA',
          eta: 'Tomorrow, 8:00 AM',
          transcript: 'Agent: Hi Mike, this is Dispatch with a check call on load 7891-B. Can you give me an update on your status?\n\nDriver: Hi, I\'m driving on I-10 near Indio, CA. I should arrive tomorrow around 8 AM.\n\nAgent: That\'s great, thank you. And how are you holding up? Is everything okay with the truck?\n\nDriver: Everything\'s good, no issues.\n\nAgent: Perfect. Drive safely and we\'ll see you tomorrow morning.',
        },
      ];
      setCallHistory(mockHistory);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadAgentConfig = async () => {
    if (isLoadingConfig) return; // Prevent multiple simultaneous calls
    setIsLoadingConfig(true);
    try {
      console.log('🔄 Loading agent config from backend...');
      const response = await axios.get(`${API_BASE_URL}/agent-config`);
      console.log('📡 Agent config response:', response.data);
      
      if (response.data.success && response.data.config) {
        const config = response.data.config;
        console.log('✅ Setting agent config:', config);
        setAgentConfig({
          prompts: config.prompts || 'No prompts configured. Please set up your agent configuration.',
          voice_settings: config.voice_settings || {
            temperature: 0.7,
            speed: 1.0,
            interruption_sensitivity: 0.8,
          },
        });
      } else {
        console.warn('⚠️ Invalid agent config response:', response.data);
        setAgentConfig(prev => ({
          ...prev,
          prompts: 'Failed to load agent configuration. Please check your backend connection.',
        }));
      }
    } catch (error) {
      console.error('❌ Failed to load agent config:', error);
      setAgentConfig(prev => ({
        ...prev,
        prompts: 'Error loading agent configuration. Please check your backend connection and try again.',
      }));
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleCallRequest = async () => {
    if (!callRequest.driver_name || !callRequest.phone_number || !callRequest.load_number) {
      setAlert({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setIsCalling(true);
    setAlert(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/trigger-call`, callRequest);
      
      setAlert({ 
        type: 'success', 
        message: `Call initiated successfully! Call ID: ${response.data.call_id}` 
      });

      // Add to call history
      const newCall: CallResult = {
        id: response.data.call_id || Date.now().toString(),
        timestamp: new Date().toISOString(),
        driver_name: callRequest.driver_name,
        phone_number: callRequest.phone_number,
        load_number: callRequest.load_number,
        status: 'in_progress',
      };
      setCallHistory(prev => [newCall, ...prev]);

      // Clear form
      setCallRequest({ driver_name: '', phone_number: '', load_number: '' });

    } catch (error: any) {
      setAlert({ 
        type: 'error', 
        message: `Failed to initiate call: ${error.response?.data?.detail || error.message}` 
      });
    } finally {
      setIsCalling(false);
    }
  };

  const handleWebCallRequest = async () => {
    if (!callRequest.driver_name || !callRequest.phone_number || !callRequest.load_number) {
      setAlert({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setIsCalling(true);
    setAlert(null);

    try {
      console.log('🎯 Triggering web call with form data');
      
      // Trigger the WebCallInterface component with form data
      setTriggerNewWebCall(true);
      
      setAlert({ 
        type: 'success', 
        message: `Starting web call with form data...` 
      });

    } catch (error: any) {
      console.error('Error creating web call:', error);
      setAlert({ type: 'error', message: `Failed to create web call: ${error.message}` });
    } finally {
      setIsCalling(false);
    }
  };

  // Handle call status changes from WebCallInterface
  const handleCallStatusChange = (status: string) => {
    console.log('📞 Call status changed:', status);
    
    if (status === 'active') {
      setAlert({ type: 'success', message: 'Voice call is now active! Speak into your microphone.' });
    } else if (status === 'ended') {
      setTriggerNewWebCall(false); // Reset trigger
      setAlert({ type: 'info', message: 'Call ended.' });
      
      // Add to call history
      const newCall: CallResult = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        driver_name: callRequest.driver_name,
        phone_number: callRequest.phone_number,
        load_number: callRequest.load_number,
        status: 'completed',
      };
      setCallHistory(prev => [newCall, ...prev]);

      // Clear form
      setCallRequest({ driver_name: '', phone_number: '', load_number: '' });
    } else if (status === 'error') {
      setTriggerNewWebCall(false); // Reset trigger
      setAlert({ type: 'error', message: 'Call failed. Please try again.' });
    }
  };

  const handleViewDetails = (call: CallResult) => {
    setSelectedCall(call);
    setDetailsOpen(true);
  };

  const handleSaveAgentConfig = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/agent-config`, {
        name: "Logistics Dispatch Agent",
        prompts: agentConfig.prompts,
        voice_settings: agentConfig.voice_settings,
      });
      
      if (response.data.success) {
        setAlert({ 
          type: 'success', 
          message: 'Agent configuration saved successfully!' 
        });
      } else {
        setAlert({ 
          type: 'error', 
          message: 'Failed to save agent configuration' 
        });
      }
    } catch (error: any) {
      setAlert({ 
        type: 'error', 
        message: `Failed to save configuration: ${error.response?.data?.detail || error.message}` 
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'in_progress':
        return <CircularProgress size={20} />;
      default:
        return <Info color="info" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Data Grid columns for call history
  const columns: GridColDef[] = [
    { field: 'timestamp', headerName: 'Time', width: 160, 
      valueFormatter: (params: any) => new Date(params.value).toLocaleString() },
    { field: 'driver_name', headerName: 'Driver', width: 130 },
    { field: 'load_number', headerName: 'Load #', width: 100 },
    { field: 'phone_number', headerName: 'Phone', width: 130 },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 110,
      renderCell: (params: any) => (
        <Chip 
          icon={getStatusIcon(params.value)} 
          label={params.value} 
          color={getStatusColor(params.value) as any}
          size="small"
        />
      )
    },
    { field: 'call_outcome', headerName: 'Outcome', width: 130 },
    { 
      field: 'transcript', 
      headerName: 'Transcript', 
      width: 200,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.value ? (
            <>
              <VoiceChat sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="caption" color="success.main">
                Available ({params.value.split('\n').length} messages)
              </Typography>
            </>
          ) : (
            <>
              <VoiceChat sx={{ fontSize: 16, color: 'grey.400' }} />
              <Typography variant="caption" color="grey.500">
                No transcript
              </Typography>
            </>
          )}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: (params: any) => (
        <Button
          size="small"
          onClick={() => handleViewDetails(params.row)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ 
      flexGrow: 1, 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.2) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }
    }}>
      {/* Professional Header */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          zIndex: 10
        }}
      >
        <Toolbar sx={{ py: 3, px: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '50%',
            p: 1.5,
            mr: 3,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}>
            <VoiceChat sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                fontWeight: 800, 
                mb: 0.5, 
                color: 'white',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                letterSpacing: '-0.02em'
              }}
            >
              AI Voice Agent Platform
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                opacity: 0.9, 
                color: 'white',
                fontWeight: 400,
                letterSpacing: '0.01em'
              }}
            >
              Professional voice AI for logistics dispatch operations
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip 
              icon={<Analytics />}
              label="AI Voice Agent" 
              sx={{ 
                color: 'white', 
                borderColor: 'rgba(255,255,255,0.3)',
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.25)',
                }
              }} 
            />
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.3)',
                transform: 'scale(1.1)'
              }
            }}>
              <Dashboard sx={{ color: 'white' }} />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 6, mb: 6, position: 'relative', zIndex: 5 }}>
        {/* Alert Messages */}
        {alert && (
          <Fade in={!!alert}>
            <Alert 
              severity={alert.type} 
              onClose={() => setAlert(null)}
              sx={{ 
                mb: 4,
                borderRadius: 3,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                '& .MuiAlert-icon': {
                  fontSize: '1.5rem'
                },
                '& .MuiAlert-message': {
                  fontSize: '1rem',
                  fontWeight: 500
                }
              }}
            >
              {alert.message}
            </Alert>
          </Fade>
        )}

        {/* Main Content Card with Glassmorphism */}
        <Grow in={true} timeout={800}>
          <Paper 
            elevation={0}
            sx={{ 
              width: '100%',
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' }
                }
              }
            }}
          >
            {/* Professional Tab Navigation */}
            <Box sx={{ 
              background: 'rgba(248, 250, 252, 0.8)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.3) 50%, transparent 100%)'
              }
            }}>
              <Tabs 
                value={activeTab} 
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{
                  '& .MuiTab-root': {
                    minHeight: 80,
                    textTransform: 'none',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: 'rgba(0, 0, 0, 0.6)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease'
                    },
                    '&:hover': {
                      color: '#667eea',
                      transform: 'translateY(-2px)',
                      '&::before': {
                        opacity: 1
                      }
                    },
                    '&.Mui-selected': {
                      color: '#667eea',
                      fontWeight: 700,
                      '&::before': {
                        opacity: 1
                      }
                    }
                  },
                  '& .MuiTabs-indicator': {
                    height: 4,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }
                }}
              >
                <Tab 
                  icon={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: activeTab === 0 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      color: activeTab === 0 ? 'white' : '#667eea',
                      mb: 1,
                      transition: 'all 0.3s ease',
                      boxShadow: activeTab === 0 ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
                    }}>
                      <VoiceChat sx={{ fontSize: 24 }} />
                    </Box>
                  } 
                  label="Voice Calls" 
                  sx={{ flex: 1, py: 2 }}
                />
                <Tab 
                  icon={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: activeTab === 1 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      color: activeTab === 1 ? 'white' : '#667eea',
                      mb: 1,
                      transition: 'all 0.3s ease',
                      boxShadow: activeTab === 1 ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
                    }}>
                      <Settings sx={{ fontSize: 24 }} />
                    </Box>
                  } 
                  label="Agent Configuration" 
                  sx={{ flex: 1, py: 2 }}
                />
                <Tab 
                  icon={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: activeTab === 2 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      color: activeTab === 2 ? 'white' : '#667eea',
                      mb: 1,
                      transition: 'all 0.3s ease',
                      boxShadow: activeTab === 2 ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
                    }}>
                      <Mic sx={{ fontSize: 24 }} />
                    </Box>
                  } 
                  label="Quick Test" 
                  sx={{ flex: 1, py: 2 }}
                />
                <Tab 
                  icon={
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: activeTab === 3 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(102, 126, 234, 0.1)',
                      color: activeTab === 3 ? 'white' : '#667eea',
                      mb: 1,
                      transition: 'all 0.3s ease',
                      boxShadow: activeTab === 3 ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
                    }}>
                      <Analytics sx={{ fontSize: 24 }} />
                    </Box>
                  } 
                  label="Call Analytics" 
                  sx={{ flex: 1, py: 2 }}
                />
              </Tabs>
            </Box>

        {/* Voice Calls Tab */}
        {activeTab === 0 && (
          <Fade in={activeTab === 0} timeout={600}>
            <Box sx={{ p: 6 }}>
              {/* Professional Header */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 6,
                position: 'relative'
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                  mr: 3,
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -2,
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    zIndex: -1,
                    opacity: 0.5,
                    filter: 'blur(8px)'
                  }
                }}>
                  <Mic sx={{ fontSize: 32, color: 'white' }} />
                </Box>
                <Box>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 800, 
                      color: 'grey.800',
                      mb: 1,
                      letterSpacing: '-0.02em'
                    }}
                  >
                    Voice Call Interface
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: 'grey.600',
                      fontWeight: 400
                    }}
                  >
                    Initiate and manage AI-powered voice calls
                  </Typography>
                </Box>
              </Box>
              
              {/* Enhanced Call Setup Card */}
              <Card 
                elevation={0}
                sx={{ 
                  mb: 6,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  boxShadow: '0 20px 60px rgba(102, 126, 234, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                  }
                }}
              >
              <CardContent sx={{ p: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    mr: 2
                  }}>
                    <Phone sx={{ fontSize: 20, color: 'white' }} />
                  </Box>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700, 
                      color: 'grey.800',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    Call Configuration
                  </Typography>
                </Box>
                
                <Stack spacing={4}>
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                    gap: 4
                  }}>
                    <TextField
                      label="Driver Name"
                      value={callRequest.driver_name}
                      onChange={(e) => setCallRequest(prev => ({ ...prev, driver_name: e.target.value }))}
                      placeholder="e.g., Mike Johnson"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(102, 126, 234, 0.1)',
                          fontSize: '1.1rem',
                          '&:hover': {
                            border: '2px solid rgba(102, 126, 234, 0.3)',
                          },
                          '&.Mui-focused': {
                            border: '2px solid #667eea',
                            boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.1)'
                          }
                        },
                        '& .MuiInputLabel-root': {
                          fontWeight: 600,
                          fontSize: '1rem'
                        }
                      }}
                    />
                    <TextField
                      label="Phone Number"
                      value={callRequest.phone_number}
                      onChange={(e) => setCallRequest(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="e.g., +1234567890"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(102, 126, 234, 0.1)',
                          fontSize: '1.1rem',
                          '&:hover': {
                            border: '2px solid rgba(102, 126, 234, 0.3)',
                          },
                          '&.Mui-focused': {
                            border: '2px solid #667eea',
                            boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.1)'
                          }
                        },
                        '& .MuiInputLabel-root': {
                          fontWeight: 600,
                          fontSize: '1rem'
                        }
                      }}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    label="Load Number"
                    value={callRequest.load_number}
                    onChange={(e) => setCallRequest(prev => ({ ...prev, load_number: e.target.value }))}
                    placeholder="e.g., 7891-B"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(102, 126, 234, 0.1)',
                        fontSize: '1.1rem',
                        '&:hover': {
                          border: '2px solid rgba(102, 126, 234, 0.3)',
                        },
                        '&.Mui-focused': {
                          border: '2px solid #667eea',
                          boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.1)'
                        }
                      },
                      '& .MuiInputLabel-root': {
                        fontWeight: 600,
                        fontSize: '1rem'
                      }
                    }}
                  />
                  
                  {/* Professional Call Action Buttons */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                    gap: 3,
                    mt: 4
                  }}>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={isCalling ? (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          '& > div': { 
                            width: 20, 
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            animation: 'ripple 1.5s infinite',
                            '@keyframes ripple': {
                              '0%': { transform: 'scale(0.8)', opacity: 0.7 },
                              '50%': { transform: 'scale(1.3)', opacity: 0.3 },
                              '100%': { transform: 'scale(0.8)', opacity: 0.7 },
                            },
                          }
                        }}>
                          <div />
                        </Box>
                      ) : <VoiceChat sx={{ fontSize: 24 }} />}
                      onClick={handleWebCallRequest}
                      disabled={isCalling}
                      sx={{ 
                        py: 3,
                        px: 4,
                        borderRadius: 4,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        background: isCalling 
                          ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: isCalling 
                          ? '0 8px 32px rgba(156, 163, 175, 0.3)'
                          : '0 8px 32px rgba(102, 126, 234, 0.4)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: '-100%',
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                          transition: 'left 0.5s ease',
                        },
                        '&:hover': {
                          boxShadow: isCalling 
                            ? '0 12px 40px rgba(156, 163, 175, 0.4)'
                            : '0 12px 40px rgba(102, 126, 234, 0.5)',
                          transform: 'translateY(-2px)',
                          '&::before': {
                            left: '100%',
                          }
                        },
                        '&:active': {
                          transform: 'translateY(0px)',
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {isCalling ? 'Creating Web Call...' : 'Start Web Call (Browser)'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={isCalling ? (
                        <LoadingSpinner size={20} variant="dots" />
                      ) : <Phone sx={{ fontSize: 24 }} />}
                      onClick={handleCallRequest}
                      disabled={isCalling}
                      sx={{ 
                        py: 3,
                        px: 4,
                        borderRadius: 4,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        borderWidth: '2px !important',
                        borderColor: isCalling ? '#9ca3af' : '#667eea',
                        color: isCalling ? '#9ca3af' : '#667eea',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: isCalling 
                            ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.1) 0%, rgba(107, 114, 128, 0.1) 100%)'
                            : 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                          opacity: 0,
                          transition: 'opacity 0.3s ease',
                        },
                        '&:hover': {
                          borderColor: isCalling ? '#9ca3af' : '#667eea',
                          transform: 'translateY(-2px)',
                          boxShadow: isCalling 
                            ? '0 8px 32px rgba(156, 163, 175, 0.2)'
                            : '0 8px 32px rgba(102, 126, 234, 0.3)',
                          '&::before': {
                            opacity: 1,
                          }
                        },
                        '&:active': {
                          transform: 'translateY(0px)',
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {isCalling ? 'Initiating Phone Call...' : 'Start Phone Call'}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* WebCallInterface for form-based calls - show when triggered */}
            {(triggerNewWebCall || activeWebCall) && (
              <Box sx={{ mt: 4 }}>
                <WebCallInterface 
                  apiBaseUrl={API_BASE_URL}
                  agentId="agent_767734af601b76e14f4945923d"
                  callData={formCallData}
                  shouldStartCall={triggerNewWebCall}
                  onCallStatusChange={handleCallStatusChange}
                />
              </Box>
            )}
          </Box>
          </Fade>
        )}

        {/* Agent Configuration Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Settings sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'grey.800' }}>
                  Agent Configuration
                </Typography>
              </Box>
              <Tooltip title="Reload configuration from server">
                <IconButton
                  onClick={loadAgentConfig}
                  disabled={isLoadingConfig}
                  sx={{
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.100' }
                  }}
                >
                  {isLoadingConfig ? (
                    <LoadingSpinner size={20} variant="pulse" />
                  ) : (
                    <Refresh />
                  )}
                </IconButton>
              </Tooltip>
            </Box>

            <Stack spacing={4}>
              {/* Prompts Configuration Card */}
              <Card 
                elevation={0}
                sx={{ 
                  border: '2px solid',
                  borderColor: 'success.100',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.02) 0%, rgba(22, 163, 74, 0.02) 100%)'
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'success.main' }}>
                    🤖 Agent Prompts & Logic
                  </Typography>
                  {isLoadingConfig ? (
                    <LoadingSpinner variant="skeleton" height={300} message="Loading agent configuration..." />
                  ) : (
                    <TextField
                      fullWidth
                      multiline
                      rows={12}
                      label="Agent Prompts & Logic"
                      value={agentConfig.prompts}
                      onChange={(e) => setAgentConfig(prev => ({ ...prev, prompts: e.target.value }))}
                      helperText="Define the conversation flow, emergency triggers, and response logic for your AI agent"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'white',
                          '& textarea': {
                            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                            fontSize: '0.875rem',
                            lineHeight: 1.6,
                          }
                        }
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Voice Settings Card */}
              <Card 
                elevation={0}
                sx={{ 
                  border: '2px solid',
                  borderColor: 'warning.100',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.02) 0%, rgba(217, 119, 6, 0.02) 100%)'
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'warning.main' }}>
                    🎚️ Voice Settings
                  </Typography>
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
                    gap: 3 
                  }}>
                    <TextField
                      type="number"
                      label="Voice Temperature"
                      value={agentConfig.voice_settings.temperature}
                      onChange={(e) => setAgentConfig(prev => ({ 
                        ...prev, 
                        voice_settings: { ...prev.voice_settings, temperature: parseFloat(e.target.value) }
                      }))}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      helperText="Creativity (0-1)"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'white'
                        }
                      }}
                    />
                    <TextField
                      type="number"
                      label="Voice Speed"
                      value={agentConfig.voice_settings.speed}
                      onChange={(e) => setAgentConfig(prev => ({ 
                        ...prev, 
                        voice_settings: { ...prev.voice_settings, speed: parseFloat(e.target.value) }
                      }))}
                      inputProps={{ min: 0.5, max: 2, step: 0.1 }}
                      helperText="Speaking rate (0.5-2)"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'white'
                        }
                      }}
                    />
                    <TextField
                      type="number"
                      label="Interruption Sensitivity"
                      value={agentConfig.voice_settings.interruption_sensitivity}
                      onChange={(e) => setAgentConfig(prev => ({ 
                        ...prev, 
                        voice_settings: { ...prev.voice_settings, interruption_sensitivity: parseFloat(e.target.value) }
                      }))}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      helperText="Interrupt threshold (0-1)"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: 'white'
                        }
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Save Button */}
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
                <Button 
                  variant="contained" 
                  size="large"
                  startIcon={<Save />}
                  onClick={handleSaveAgentConfig}
                  sx={{ 
                    px: 6,
                    py: 2,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                    },
                    fontSize: '1.1rem',
                    fontWeight: 600
                  }}
                >
                  Save Configuration
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Quick Test Tab */}
        {activeTab === 2 && (
          <Fade in={activeTab === 2} timeout={600}>
            <Box sx={{ p: 6 }}>
              {/* Professional Header */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 6,
                position: 'relative'
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
                  mr: 3,
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: -2,
                    borderRadius: '22px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    zIndex: -1,
                    opacity: 0.5,
                    filter: 'blur(8px)'
                  }
                }}>
                  <Mic sx={{ fontSize: 32, color: 'white' }} />
                </Box>
                <Box>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontWeight: 800, 
                      color: 'grey.800',
                      mb: 1,
                      letterSpacing: '-0.02em'
                    }}
                  >
                    Quick Voice Test
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: 'grey.600',
                      fontWeight: 400
                    }}
                  >
                    Test the AI voice agent instantly without configuration
                  </Typography>
                </Box>
              </Box>

              {/* Quick Test Interface */}
              <Box sx={{ 
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderRadius: 4,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                boxShadow: '0 20px 60px rgba(16, 185, 129, 0.1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                }
              }}>
                {/* Legacy Web Call Interface (for fallback) */}
                {activeWebCall && (
                  <LegacyWebCallInterface
                    accessToken={activeWebCall}
                    onCallEnd={() => setActiveWebCall(null)}
                  />
                )}
                
                {/* Main Web Call Interface */}
                <WebCallInterface 
                  apiBaseUrl={API_BASE_URL}
                  agentId="agent_767734af601b76e14f4945923d"
                  callData={quickTestCallData}
                  shouldStartCall={false}
                  onCallStatusChange={(status) => {
                    console.log('Quick test call status:', status);
                    if (status === 'active') {
                      setAlert({ type: 'success', message: 'Quick test call is now active! Speak into your microphone.' });
                    } else if (status === 'ended') {
                      setAlert({ type: 'info', message: 'Quick test call ended.' });
                    } else if (status === 'error') {
                      setAlert({ type: 'error', message: 'Quick test call failed. Please try again.' });
                    }
                  }}
                />
              </Box>
            </Box>
          </Fade>
        )}

        {/* Call Analytics Tab */}
        {activeTab === 3 && (
          <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Analytics sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'grey.800' }}>
                  Call Analytics
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={loadCallHistory}
                disabled={isLoadingHistory}
                startIcon={isLoadingHistory ? (
                  <LoadingSpinner size={20} variant="pulse" />
                ) : <History />}
                sx={{ 
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                  }
                }}
              >
                {isLoadingHistory ? 'Loading...' : 'Load Call History'}
              </Button>
            </Box>

            {/* Loading State */}
            {isLoadingHistory && (
              <Card 
                elevation={0}
                sx={{ 
                  border: '2px solid',
                  borderColor: 'info.100',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(37, 99, 235, 0.02) 100%)'
                }}
              >
                <CardContent sx={{ p: 6 }}>
                  <LoadingSpinner 
                    variant="skeleton" 
                    height={300} 
                    message="Loading call analytics data..." 
                  />
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {callHistory.length === 0 && !isLoadingHistory && (
              <Card 
                elevation={0}
                sx={{ 
                  border: '2px solid',
                  borderColor: 'grey.200',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.02) 0%, rgba(107, 114, 128, 0.02) 100%)'
                }}
              >
                <CardContent sx={{ p: 6, textAlign: 'center' }}>
                  <History sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Call Records Found
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Click "Load Call History" to view your call analytics data
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={loadCallHistory}
                    startIcon={<History />}
                    sx={{ borderRadius: 2 }}
                  >
                    Load Call History
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Data Grid */}
            {callHistory.length > 0 && !isLoadingHistory && (
              <Card 
                elevation={0}
                sx={{ 
                  border: '2px solid',
                  borderColor: 'info.100',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ height: 500, width: '100%' }}>
                  <DataGrid
                    rows={callHistory}
                    columns={columns}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 10 },
                      },
                    }}
                    pageSizeOptions={[10, 25, 50]}
                    disableRowSelectionOnClick
                    autoHeight
                    sx={{
                      border: 'none',
                      '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: 'grey.50',
                        borderBottom: '2px solid',
                        borderColor: 'grey.200',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      },
                      '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid',
                        borderColor: 'grey.100',
                      },
                      '& .MuiDataGrid-row:hover': {
                        backgroundColor: 'rgba(102, 126, 234, 0.04)',
                      }
                    }}
                  />
                </Box>
              </Card>
            )}
          </Box>
        )}
          </Paper>
        </Grow>
      </Container>
      {/* Call Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Call Details - {selectedCall?.driver_name} ({selectedCall?.load_number})
        </DialogTitle>
        <DialogContent>
          {selectedCall && (
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <Typography variant="subtitle2" color="text.secondary">Driver</Typography>
                  <Typography variant="body1">{selectedCall.driver_name}</Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
                  <Typography variant="body1">{selectedCall.phone_number}</Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <Typography variant="subtitle2" color="text.secondary">Load Number</Typography>
                  <Typography variant="body1">{selectedCall.load_number}</Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    icon={getStatusIcon(selectedCall.status)} 
                    label={selectedCall.status} 
                    color={getStatusColor(selectedCall.status) as any}
                  />
                </Box>
              </Box>

              {selectedCall.call_outcome && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Structured Data Summary</Typography>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {selectedCall.call_outcome && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">Call Outcome</Typography>
                            <Typography variant="body1">{selectedCall.call_outcome}</Typography>
                          </Box>
                        )}
                        {selectedCall.driver_status && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">Driver Status</Typography>
                            <Typography variant="body1">{selectedCall.driver_status}</Typography>
                          </Box>
                        )}
                        {selectedCall.current_location && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">Current Location</Typography>
                            <Typography variant="body1">{selectedCall.current_location}</Typography>
                          </Box>
                        )}
                        {selectedCall.eta && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">ETA</Typography>
                            <Typography variant="body1">{selectedCall.eta}</Typography>
                          </Box>
                        )}
                        {selectedCall.emergency_type && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">Emergency Type</Typography>
                            <Typography variant="body1" color="error">{selectedCall.emergency_type}</Typography>
                          </Box>
                        )}
                        {selectedCall.emergency_location && (
                          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                            <Typography variant="subtitle2" color="text.secondary">Emergency Location</Typography>
                            <Typography variant="body1" color="error">{selectedCall.emergency_location}</Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Full Transcript Section */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Full Transcript</Typography>
                <Card>
                  <CardContent>
                    {selectedCall.transcript ? (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedCall.transcript}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No transcript available for this call
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {/* Structured Data Section */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Structured Data</Typography>
                <Card>
                  <CardContent>
                    {selectedCall.structured_data ? (
                      <Box>
                        <pre style={{ 
                          backgroundColor: '#f5f5f5', 
                          padding: '16px', 
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace'
                        }}>
                          {JSON.stringify(selectedCall.structured_data, null, 2)}
                        </pre>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No structured data extracted from this call
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;