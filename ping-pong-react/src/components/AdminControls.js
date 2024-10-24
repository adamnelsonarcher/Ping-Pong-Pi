import React, { useState, useEffect } from 'react';
import { getPlayers, editPlayerPassword, editPlayerScore, deletePlayer, resetAllScores, updateSettings, getSettings } from '../services/dataService';
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
    if (window.confirm('Are you sure you want to reset all scores?')) {
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
    SCORE_CHANGE_K_FACTOR: "Maximum points that can be won or lost in a game.",
    POINT_DIFFERENCE_WEIGHT: "Multiplier for the point difference at the end of a game.",
    ACTIVITY_THRESHOLD: "Number of games a player needs to play to become ranked.",
    GAME_HISTORY_KEEP: "Number of games to keep stored in the history.",
    ADDPLAYER_ADMINONLY: "Determines if only admins can add new players.",
    DEFAULT_RANK: "Default rank for new players.",
    PLAYER1_SCOREBOARD_COLOR: "Color of the scoreboard for Player 1.",
    PLAYER2_SCOREBOARD_COLOR: "Color of the scoreboard for Player 2."
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
        
        <form onSubmit={handleEditPassword} className="input-group">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" />
          <button type="submit">Edit Password</button>
        </form>
        
        <form onSubmit={handleEditScore} className="input-group">
          <input type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)} placeholder="New Score" />
          <button type="submit">Edit Score</button>
        </form>
        
        <button onClick={handleDeletePlayer} className="delete-btn">Delete Player</button>
      </div>

      <div className="admin-section">
        <h3>Global Actions</h3>
        <button onClick={handleResetAllScores} className="reset-btn">Reset All Scores</button>
      </div>

      <div className="admin-section">
        <h3>Game Settings</h3>
        {gameSettings && (
          <form onSubmit={saveSettings} className="settings-list">
            {Object.entries(gameSettings).map(([key, value]) => (
              <div key={key} className="setting-item">
                <label htmlFor={key}>{key.replace(/_/g, ' ')}:</label>
                <p className="setting-description">{settingDescriptions[key]}</p>
                <input
                  id={key}
                  type={typeof value === 'boolean' ? 'checkbox' : 'text'}
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
            <button type="submit" className="save-btn">Save Settings</button>
          </form>
        )}
      </div>

      <button onClick={onExit} className="exit-btn">Exit Admin Controls</button>
    </div>
  );
}

export default AdminControls;
