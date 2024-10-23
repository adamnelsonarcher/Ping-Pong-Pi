import React, { useState } from 'react';
import dataService from '../services/dataService';

function AdminControls({ onExit }) {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');

  const handleEditPassword = () => {
    if (selectedPlayer && newPassword) {
      dataService.editPlayerPassword(selectedPlayer, newPassword);
      setNewPassword('');
    }
  };

  const handleEditScore = () => {
    if (selectedPlayer && newScore) {
      dataService.editPlayerScore(selectedPlayer, parseFloat(newScore));
      setNewScore('');
    }
  };

  const handleDeletePlayer = () => {
    if (selectedPlayer) {
      dataService.deletePlayer(selectedPlayer);
      setSelectedPlayer('');
    }
  };

  const handleResetAllScores = () => {
    dataService.resetAllScores();
  };

  return (
    <div className="AdminControls">
      <h2>Admin Controls</h2>
      <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
        <option value="">Select Player</option>
        {Object.keys(dataService.players).map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <div>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" />
        <button onClick={handleEditPassword}>Edit Password</button>
      </div>
      <div>
        <input type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)} placeholder="New Score" />
        <button onClick={handleEditScore}>Edit Score</button>
      </div>
      <button onClick={handleDeletePlayer}>Delete Player</button>
      <button onClick={handleResetAllScores}>Reset All Scores</button>
      <button onClick={onExit}>Exit Admin Controls</button>
    </div>
  );
}

export default AdminControls;
