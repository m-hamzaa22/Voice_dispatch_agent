import React from 'react';
import { Box, CircularProgress, Typography, Skeleton } from '@mui/material';

interface LoadingSpinnerProps {
  size?: number;
  message?: string;
  variant?: 'circular' | 'skeleton' | 'dots' | 'pulse';
  height?: number;
  width?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  message,
  variant = 'circular',
  height = 60,
  width = '100%'
}) => {
  if (variant === 'skeleton') {
    return (
      <Box sx={{ width }}>
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 2 }} />
        {message && (
          <Skeleton variant="text" sx={{ mt: 1, maxWidth: 200 }} />
        )}
      </Box>
    );
  }

  if (variant === 'dots') {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        py: 2
      }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#667eea',
                animation: 'dotPulse 1.4s infinite ease-in-out',
                animationDelay: `${i * 0.16}s`,
                '@keyframes dotPulse': {
                  '0%, 80%, 100%': {
                    transform: 'scale(0)',
                    opacity: 0.5,
                  },
                  '40%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              }}
            />
          ))}
        </Box>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  if (variant === 'pulse') {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        py: 2
      }}>
        <Box
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(0.8)',
                opacity: 1,
              },
              '50%': {
                transform: 'scale(1.2)',
                opacity: 0.7,
              },
              '100%': {
                transform: 'scale(0.8)',
                opacity: 1,
              },
            },
          }}
        />
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  // Default circular variant
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 2,
      py: 2
    }}>
      <CircularProgress 
        size={size} 
        sx={{ 
          color: '#667eea',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          }
        }} 
      />
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;
