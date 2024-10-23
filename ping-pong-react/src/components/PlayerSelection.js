import React from 'react';

function PlayerSelection({ players, selectedPlayers, onPlayerSelect }) {
  return (
    <div className="PlayerSelection">
      {[1, 2].map((playerNum) => (
        <select
          key={playerNum}
          value={selectedPlayers[`player${playerNum}`] || ''}
          onChange={(e) => onPlayerSelect(players.find(p => p.name === e.target.value), playerNum - 1)}
        >
          <option value="">Select Player {playerNum}</option>
          {players.map(player => (
            <option key={player.name} value={player.name}>{player.name}</option>
          ))}
        </select>
      ))}
    </div>
  );
}

export default PlayerSelection;
