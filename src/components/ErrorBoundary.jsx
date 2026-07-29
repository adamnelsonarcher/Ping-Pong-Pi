import React from 'react';
import './ErrorBoundary.css';

/**
 * Catches render-time crashes so the app degrades to a message instead of a
 * blank page.
 *
 * This matters more than usual here: the target deployment is a display bolted
 * to a wall that nobody is looking at closely. A white screen is an outage that
 * lasts until somebody notices and knows to clear their browser storage
 * (docs/AUDIT.md Q-10).
 *
 * The "reset app data" escape hatch is there because the historical way to brick
 * this app was a bad value in localStorage (docs/AUDIT.md D-06).
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in React tree:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetSession = () => {
    if (
      !window.confirm(
        'This signs you out and clears this browser\'s saved session.\n\n' +
          'Cloud accounts are unaffected. Data saved in local-storage mode on this ' +
          'device will be lost unless you have a backup.\n\nContinue?'
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLocalMode');
    } catch {
      /* localStorage can be unavailable in private browsing */
    }
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary-content">
          <h1>🏓</h1>
          <h2>Something went wrong</h2>
          <p>The app hit an error it could not recover from.</p>

          <pre className="error-boundary-detail">
            {this.state.error?.message || String(this.state.error)}
          </pre>

          <div className="error-boundary-actions">
            <button type="button" onClick={this.handleReload}>
              Reload
            </button>
            <button type="button" className="secondary" onClick={this.handleResetSession}>
              Sign out and reset
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
