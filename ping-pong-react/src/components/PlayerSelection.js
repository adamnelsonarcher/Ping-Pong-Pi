import React from 'react';
import './PlayerSelection.css';  // Add this line if it's not already there

function PlayerSelection({ players, selectedPlayers, onPlayerSelect }) {
  return (
    <div className="PlayerSelection">
      <div className="player-select-container">
        <div className="player-select">
          <label htmlFor="player1">Player 1: </label>
          <select
            id="player1"
            value={selectedPlayers.player1 || ''}
            onChange={(e) => onPlayerSelect(e.target.value, 0)}
          >
            <option value="">Select Player</option>
            {players.map((player) => (
              <option key={player.name} value={player.name}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
        <div className="player-select">
          <label htmlFor="player2">Player 2: </label>
          <select
            id="player2"
            value={selectedPlayers.player2 || ''}
            onChange={(e) => onPlayerSelect(e.target.value, 1)}
          >
            <option value="">Select Player</option>
            {players.map((player) => (
              <option key={player.name} value={player.name}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default PlayerSelection;
