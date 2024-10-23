import React, { useState } from 'react';

function PlayerSelection({ players, onPlayersSelected }) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    if (player1 && player2) {
      onPlayersSelected({ player1, player2 });
    }
  };

  return (
    <div className="PlayerSelection">
      <select value={player1} onChange={handleChange(setPlayer1)}>
        <option value="">Select Player</option>
        {players.map(player => (
          <option key={player.name} value={player.name}>{player.name}</option>
        ))}
      </select>
      <select value={player2} onChange={handleChange(setPlayer2)}>
        <option value="">Select Player</option>
        {players.map(player => (
          <option key={player.name} value={player.name}>{player.name}</option>
        ))}
      </select>
    </div>
  );
}

export default PlayerSelection;
