import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import dataService from '../services/dataService';

const SettingsContext = createContext(null);

/**
 * Live view of the current account's settings.
 *
 * This used to fetch settings once on mount and never update them, so changing
 * a setting in the admin panel appeared to do nothing until a full page reload —
 * including DISABLE_WIN_ANIMATION, the escape hatch for the victory strobe
 * (docs/AUDIT.md L-03). It also raced App's own load and could clobber it with
 * an empty account (docs/AUDIT.md D-07).
 *
 * It now owns no data of its own: it mirrors dataService and re-renders when
 * dataService says something changed.
 */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...dataService.settings }));

  useEffect(
    () => dataService.subscribe(() => setSettings({ ...dataService.settings })),
    []
  );

  const updateSettings = useCallback(async (next) => {
    await dataService.updateSettings(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
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
