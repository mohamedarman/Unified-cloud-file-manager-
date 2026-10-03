import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App';
import { AuthProvider } from './context/AuthContext';
import { FileManagerProvider } from './context/FileManagerContext';
import { InfrastructureProvider } from './context/InfrastructureContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

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
