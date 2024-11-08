import React, { createContext, useState, useContext, useEffect } from 'react';
import { getSettings } from '../services/dataService';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      console.log('Loading settings (once)...');
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
