import React, { useSyncExternalStore, useState } from 'react';
import dataService from '../services/dataService';
import './SaveStatus.css';

const subscribe = (listener) => dataService.subscribe(listener);
const getVersion = () => dataService.version;

/**
 * A persistent banner shown while a cloud save is failing.
 *
 * Save failures were previously invisible: `saveData` retried twice, set
 * `lastSaveError`, and nothing ever read it (docs/AUDIT.md D-02). A game recorded
 * during a network blip would sit unsaved on the device with no sign anything was
 * wrong. This makes that state visible and gives the user a way to retry.
 *
 * A banner rather than a toast on purpose: an unsaved change is a standing
 * condition, not a passing event, and it should stay on screen until it is
 * actually resolved.
 */
function SaveStatus() {
  // Re-render whenever the store changes; lastSaveError is set and cleared with
  // an _emit() on either side.
  useSyncExternalStore(subscribe, getVersion);
  const [retrying, setRetrying] = useState(false);

  if (!dataService.lastSaveError) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await dataService.saveData();
    } catch {
      /* the banner stays; lastSaveError is still set */
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="save-status" role="alert">
      <span className="save-status-icon" aria-hidden="true">
        ⚠️
      </span>
      <span className="save-status-message">
        Couldn&apos;t save to the server. Your recent changes are safe on this device
        but are not yet synced.
      </span>
      <button
        type="button"
        className="save-status-retry"
        onClick={handleRetry}
        disabled={retrying}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

export default SaveStatus;
