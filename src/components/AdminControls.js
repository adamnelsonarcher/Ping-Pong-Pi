import React, { useState, useEffect } from 'react';
import { getPlayers, editPlayerPassword, editPlayerScore, deletePlayer, resetAllScores, updateSettings, getSettings } from '../services/dataService';
import { useSettings } from '../contexts/SettingsContext';
import './AdminControls.css';
import dataService from '../services/dataService';

function AdminControls({ onExit, onAddPlayer }) {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');
  const [gameSettings, setGameSettings] = useState(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const playerList = await getPlayers();
      setPlayers(playerList);
      const settings = await getSettings();
      setGameSettings(settings);
    };
    loadData();
  }, []);

  const handleEditPassword = async (e) => {
    e.preventDefault();
    if (selectedPlayer && newPassword) {
      await editPlayerPassword(selectedPlayer, newPassword);
      setNewPassword('');
      alert('Password updated successfully');
    }
  };

  const handleEditScore = async (e) => {
    e.preventDefault();
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
    if (window.confirm('Are you sure you want to reset all scores? This impacts all players, but not lifetime scores.')) {
      await resetAllScores();
      alert('All scores have been reset');
    }
  };

  const handleSettingChange = (setting, value) => {
    setGameSettings({ ...gameSettings, [setting]: value });
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    if (gameSettings) {
      await updateSettings(gameSettings);
      alert('Settings updated successfully');
    }
  };

  const settingDescriptions = {
    TIMER_INTERVAL: "Time in minutes before player selection is cleared.",
    SCORE_CHANGE_K_FACTOR: "Maximum points that can be won or lost in a game, before the point difference is factored in.",
    POINT_DIFFERENCE_WEIGHT: "Multiplier for the point difference at the end of a game. Increases K by the point difference times this value.",
    ACTIVITY_THRESHOLD: "Number of games a player needs to play to become ranked/active.",
    GAME_HISTORY_KEEP: "Number of games to show in the game history.",
    ADDPLAYER_ADMINONLY: "Moves the 'Add New Player' button to the admin controls section.",
    DEFAULT_RANK: "Text that shows instead of score for for unranked/inactive players.",
    PLAYER1_SCOREBOARD_COLOR: "Color of the scoreboard for Player 1.",
    PLAYER2_SCOREBOARD_COLOR: "Color of the scoreboard for Player 2."
  };

  const renderSettingInput = (key, value) => {
    if (key.includes('COLOR')) {
      return (
        <div className="color-input-container">
          <input
            type="color"
            value={value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            style={{ marginLeft: '10px' }}
          />
        </div>
      );
    }
    
    return (
      <input
        type={typeof value === 'boolean' ? 'checkbox' : 'text'}
        checked={typeof value === 'boolean' ? value : undefined}
        value={typeof value === 'boolean' ? undefined : value}
        onChange={(e) => handleSettingChange(key, 
          typeof value === 'boolean' ? e.target.checked : 
          typeof value === 'number' ? parseFloat(e.target.value) : 
          e.target.value
        )}
      />
    );
  };

  const handleResetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all settings to their defaults?')) {
      // Import default values from settings1.js
      const defaultSettings = {
        TIMER_INTERVAL: 5,
        SCORE_CHANGE_K_FACTOR: 70,
        POINT_DIFFERENCE_WEIGHT: 6,
        ACTIVITY_THRESHOLD: 3,
        DEFAULT_RANK: "Unranked",
        PLAYER1_SCOREBOARD_COLOR: '#4CAF50',
        PLAYER2_SCOREBOARD_COLOR: '#2196F3',
        GAME_HISTORY_KEEP: 30,
        ADDPLAYER_ADMINONLY: false
      };

      setGameSettings(defaultSettings);
      await updateSettings(defaultSettings);
      alert('Settings have been reset to defaults');
    }
  };

  const handleChangeAdminPassword = async () => {
    if (newAdminPassword.length < 4) {
      alert('Password must be at least 4 characters long');
      return;
    }
    
    const updatedSettings = {
      ...gameSettings,
      ADMIN_PASSWORD: newAdminPassword
    };
    
    try {
      await updateSettings(updatedSettings);
      setGameSettings(updatedSettings);
      setNewAdminPassword('');
      alert('Admin password updated successfully');
    } catch (error) {
      console.error('Error updating admin password:', error);
      alert('Failed to update admin password');
    }
  };



  return (
    <div className="admin-controls">
      <h2>Admin Controls</h2>
      
      {gameSettings?.ADDPLAYER_ADMINONLY && (
        <div className="admin-section">
          <h3>Add New Player</h3>
          <button className="standard-btn" onClick={onAddPlayer}>
            Add New Player
          </button>
        </div>
      )}

      <div className="admin-section">
        <h3>Player Management</h3>
        <select 
          value={selectedPlayer} 
          onChange={(e) => setSelectedPlayer(e.target.value)}
          style={{ marginBottom: '20px' }}
        >
          <option value="">Select Player</option>
          {players.map(player => (
            <option key={player.name} value={player.name}>{player.name}</option>
          ))}
        </select>

        <form onSubmit={handleEditPassword}>
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="submit" class="standard-btn">Update Password</button>
        </form>

        <form onSubmit={handleEditScore}>
          <input
            type="number"
            placeholder="New Score"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
          />
          <button type="submit" class="standard-btn">Update Score</button>
        </form>

        <div className="button-group">
          <button className="delete-btn" onClick={handleDeletePlayer}>Delete Player</button>
          <button className="reset-btn" onClick={handleResetAllScores}>Reset All Scores</button>
        </div>
      </div>

      <div className="admin-section">
        <h3>Admin Password</h3>
        <div className="setting-item">
          <label>Change Admin Password</label>
          <div className="password-input-container">
            <input
              type={showAdminPassword ? "text" : "password"}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="New Admin Password"
            />
            <button 
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowAdminPassword(!showAdminPassword)}
            >
              {showAdminPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <button 
            className="standard-btn"
            onClick={handleChangeAdminPassword}
          >
            Update Admin Password
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>Game Settings</h3>
        {gameSettings && (
          <form onSubmit={saveSettings} className="settings-list">
            {Object.entries(gameSettings)
              .filter(([key]) => key !== 'ADMIN_PASSWORD')
              .map(([key, value]) => (
                <div key={key} className="setting-item">
                  <label>{key.replace(/_/g, ' ')}</label>
                  <p className="setting-description">{settingDescriptions[key]}</p>
                  {renderSettingInput(key, value)}
                </div>
            ))}
            <div className="button-group">
              <button type="submit" className="save-btn">Save Settings</button>
              <button type="button" onClick={handleResetToDefaults} className="reset-defaults-btn">
                Reset to Defaults
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="exit-button-container">
        <button 
          className="exit-btn"
          onClick={() => {
            setIsAdmin(false);
            if (onExit) onExit();
          }}
        >
          Exit Admin Controls
        </button>
      </div>
    </div>
  );
}

export default AdminControls;
