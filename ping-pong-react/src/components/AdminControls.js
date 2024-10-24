import React, { useState, useEffect } from 'react';
import dataService, { getPlayers, editPlayerPassword, editPlayerScore, deletePlayer, resetAllScores, updateSettings } from '../services/dataService';
import settings from '../settings';
import './AdminControls.css';

function AdminControls({ onExit }) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');
  const [adminSettings, setAdminSettings] = useState({ ...settings });

  useEffect(() => {
    const loadPlayers = async () => {
      const playerList = await getPlayers();
      setPlayers(playerList);
    };
    loadPlayers();
  }, []);

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
    setAdminSettings({ ...adminSettings, [setting]: value });
  };

  const saveSettings = async () => {
    await updateSettings(adminSettings);
    alert('Settings updated successfully');
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
        <div className="settings-list">
          <div className="setting-item">
            <label htmlFor="timerInterval">Timer Interval (minutes):</label>
            <input
              id="timerInterval"
              type="number"
              value={adminSettings.TIMER_INTERVAL}
              onChange={(e) => handleSettingChange('TIMER_INTERVAL', parseFloat(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label htmlFor="scoreChangeKFactor">Score Change K Factor:</label>
            <input
              id="scoreChangeKFactor"
              type="number"
              value={adminSettings.SCORE_CHANGE_K_FACTOR}
              onChange={(e) => handleSettingChange('SCORE_CHANGE_K_FACTOR', parseFloat(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label htmlFor="pointDifferenceWeight">Point Difference Weight:</label>
            <input
              id="pointDifferenceWeight"
              type="number"
              value={adminSettings.POINT_DIFFERENCE_WEIGHT}
              onChange={(e) => handleSettingChange('POINT_DIFFERENCE_WEIGHT', parseFloat(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label htmlFor="activityThreshold">Activity Threshold:</label>
            <input
              id="activityThreshold"
              type="number"
              value={adminSettings.ACTIVITY_THRESHOLD}
              onChange={(e) => handleSettingChange('ACTIVITY_THRESHOLD', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item">
            <label htmlFor="gameHistoryKeep">Game History Keep:</label>
            <input
              id="gameHistoryKeep"
              type="number"
              value={adminSettings.GAME_HISTORY_KEEP}
              onChange={(e) => handleSettingChange('GAME_HISTORY_KEEP', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-item checkbox">
            <label htmlFor="addPlayerAdminOnly">
              <input
                id="addPlayerAdminOnly"
                type="checkbox"
                checked={adminSettings.ADDPLAYER_ADMINONLY}
                onChange={(e) => handleSettingChange('ADDPLAYER_ADMINONLY', e.target.checked)}
              />
              Add Player Admin Only
            </label>
          </div>
        </div>
        <button onClick={saveSettings} className="save-btn">Save Settings</button>
      </div>

      <button onClick={onExit} className="exit-btn">Exit Admin Controls</button>
    </div>
  );
}

export default AdminControls;
