import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App';
import { AuthProvider } from './context/AuthContext';
import { FileManagerProvider } from './context/FileManagerContext';
import { InfrastructureProvider } from './context/InfrastructureContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Force HTTPS in production environments without breaking local development
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  !window.location.hostname.includes('localhost') &&
  window.location.hostname !== '127.0.0.1' &&
  !window.location.hostname.endsWith('.internal')
) {
  window.location.replace(window.location.href.replace('http:', 'https:'));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <FileManagerProvider>
          <InfrastructureProvider>
            <AppContent />
          </InfrastructureProvider>
        </FileManagerProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
