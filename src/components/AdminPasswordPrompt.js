import React, { useState } from 'react';
import './AdminPasswordPrompt.css';

function AdminPasswordPrompt({ onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="admin-password-prompt">
      <div className="prompt-content">
        <div className="prompt-header">
          <span className="lock-icon">🔒</span>
          <h2>Set Admin Password</h2>
        </div>
        
        <div className="info-section">
          <div className="info-card">
            <h3>What is this for?</h3>
            <p>The admin settings panel lets you:</p>
            <ul>
              <li>Modify game settings</li>
              <li>Edit player data</li>
              <li>Manage system preferences</li>
            </ul>
            <p>This basically makes sure that not everyone can mess with the important stuff</p>
          </div>
          
        </div>

        <form onSubmit={handleSubmit}>
          <div className="password-inputs">
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm admin password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          
          {error && <div className="error-message">⚠️ {error}</div>}
          
          <div className="button-group">
            <button type="submit">
              <span className="btn-icon">🔐</span>
              Set Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPasswordPrompt; 