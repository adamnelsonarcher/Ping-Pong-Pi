import React, { useState, useEffect } from 'react';
import './PlayerSelection.css';
//import { useSettings } from '../contexts/SettingsContext';

function PlayerSelection({ players, selectedPlayers, onPlayerSelect }) {
  const [selectedPlayer1, setSelectedPlayer1] = useState(selectedPlayers.player1 || '');
  const [selectedPlayer2, setSelectedPlayer2] = useState(selectedPlayers.player2 || '');
  //const { settings } = useSettings();

  useEffect(() => {
    setSelectedPlayer1(selectedPlayers.player1 || '');
    setSelectedPlayer2(selectedPlayers.player2 || '');
  }, [selectedPlayers]);

  const handlePlayerSelect = (player, playerIndex) => {
    if (playerIndex === 0) {
      setSelectedPlayer1(player);
    } else {
      setSelectedPlayer2(player);
    }
    onPlayerSelect(player, playerIndex);
  };

  // Sort players alphabetically by name
  const sortedPlayers = [...players].sort((a, b) => 
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  return (
    <div className="PlayerSelection">
      <div className="player-select-container">
        <div className="player-select">
          <label htmlFor="player1">Player 1: </label>
          <select
            id="player1"
            value={selectedPlayer1}
            onChange={(e) => handlePlayerSelect(e.target.value, 0)}
            onKeyDown={(e) => e.preventDefault()} // Prevent keyboard input
          >
            <option value="">Select Player</option>
            {sortedPlayers.map((player) => (
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
            value={selectedPlayer2}
            onChange={(e) => handlePlayerSelect(e.target.value, 1)}
            onKeyDown={(e) => e.preventDefault()} // Prevent keyboard input
          >
            <option value="">Select Player</option>
            {sortedPlayers.map((player) => (
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
