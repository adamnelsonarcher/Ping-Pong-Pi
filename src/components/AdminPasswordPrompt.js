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
        <h2>Set Admin Password</h2>
        <p>This is the first account created on this system. Please set an admin password that will be used to access game settings.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm admin password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <div className="error-message">{error}</div>}
          <div className="button-group">
            <button type="submit">Set Admin Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPasswordPrompt; 