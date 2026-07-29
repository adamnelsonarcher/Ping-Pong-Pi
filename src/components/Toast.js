import React, { useEffect } from 'react';
import './Toast.css';

/**
 * Transient on-screen message.
 *
 * Replaces alert() for routine feedback. Native dialogs block the event loop,
 * cannot be styled, and on a wall-mounted display with no mouse they can be
 * genuinely hard to dismiss (docs/AUDIT.md A-03). window.confirm is still used
 * for destructive actions, where a blocking prompt is the right call.
 */
function Toast({ message, tone = 'info', duration = 4000, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default Toast;
