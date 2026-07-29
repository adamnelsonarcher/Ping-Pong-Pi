import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';

// ThemeProvider sits above everything so the login and loading screens are
// themed too — it used to live inside App, below the early returns that render
// those screens.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Hide the static loading screen from index.html now that React has rendered.
// It used to hide itself on window 'load', which happens whether or not the app
// mounted, turning a startup crash into a blank white page.
document.getElementById('initial-loader')?.remove();
