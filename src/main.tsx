import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App';
import { AuthProvider } from './context/AuthContext';
import { FileManagerProvider } from './context/FileManagerContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <FileManagerProvider>
            <AppContent />
          </FileManagerProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
