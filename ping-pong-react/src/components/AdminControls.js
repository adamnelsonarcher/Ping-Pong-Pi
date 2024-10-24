import React, { useState, useEffect } from 'react';
import dataService, { getPlayers, editPlayerPassword, editPlayerScore, deletePlayer, resetAllScores, updateSettings, getSettings } from '../services/dataService';
import './AdminControls.css';

function AdminControls({ onExit }) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');
  const [gameSettings, setGameSettings] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const playerList = await getPlayers();
      setPlayers(playerList);
      const settings = getSettings();
      setGameSettings(settings);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      const settings = getSettings(selectedPlayer);
      setGameSettings(settings);
    } else {
      setGameSettings(null);
    }
  }, [selectedPlayer]);

  const handleEditPassword = async () => {
    if (selectedPlayer && newPassword) {
      await editPlayerPassword(selectedPlayer, newPassword);
      setNewPassword('');
      alert('Password updated successfully');
    }
  };

  const handleEditScore = async () => {
    if (selectedPlayer && newScore) {
      await editPlayerScore(selectedPlayer, parseFloat(newScore));
      setNewScore('');
      alert('Score updated successfully');
    }
  };

  const handleDeletePlayer = async () => {
    if (selectedPlayer) {
      if (window.confirm(`Are you sure you want to delete ${selectedPlayer}?`)) {
        await deletePlayer(selectedPlayer);
        setPlayers(players.filter(p => p.name !== selectedPlayer));
        setSelectedPlayer('');
      }
    }
  };

  const handleResetAllScores = async () => {
    if (window.confirm('Are you sure you want to reset all scores?')) {
      await resetAllScores();
      alert('All scores have been reset');
    }
  };

  const handleSettingChange = (setting, value) => {
    setGameSettings({ ...gameSettings, [setting]: value });
  };

  const saveSettings = async () => {
    if (gameSettings) {
      await updateSettings(gameSettings);
      alert('Settings updated successfully');
    }
  };

  const formatSettingName = (name) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="admin-controls">
      <h2>Admin Controls</h2>
      
      <div className="admin-section">
        <h3>Player Management</h3>
        <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
          <option value="">Select a player</option>
          {players.map(player => (
            <option key={player.name} value={player.name}>{player.name}</option>
          ))}
        </select>
        
        <div className="input-group">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" />
          <button onClick={handleEditPassword}>Edit Password</button>
        </div>
        
        <div className="input-group">
          <input type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)} placeholder="New Score" />
          <button onClick={handleEditScore}>Edit Score</button>
        </div>
        
        <button onClick={handleDeletePlayer} className="delete-btn">Delete Player</button>
      </div>

      <div className="admin-section">
        <h3>Global Actions</h3>
        <button onClick={handleResetAllScores} className="reset-btn">Reset All Scores</button>
      </div>

      <div className="admin-section">
        <h3>Game Settings</h3>
        {gameSettings && (
          <div className="settings-list">
            {Object.entries(gameSettings).map(([key, value]) => (
              <div key={key} className="setting-item">
                <label htmlFor={key}>{formatSettingName(key)}:</label>
                <input
                  id={key}
                  type={typeof value === 'boolean' ? 'checkbox' : 'number'}
                  checked={typeof value === 'boolean' ? value : undefined}
                  value={typeof value === 'boolean' ? undefined : value}
                  onChange={(e) => handleSettingChange(key, 
                    typeof value === 'boolean' ? e.target.checked : 
                    typeof value === 'number' ? parseFloat(e.target.value) : 
                    e.target.value
                  )}
                />
              </div>
            ))}
            <button onClick={saveSettings} className="save-btn">Save Settings</button>
          </div>
        )}
      </div>

      <button onClick={onExit} className="exit-btn">Exit Admin Controls</button>
    </div>
  );
}

export default AdminControls;
