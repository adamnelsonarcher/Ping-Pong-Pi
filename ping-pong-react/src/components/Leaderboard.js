import React, { useState } from 'react';
import './Leaderboard.css';
import LifetimeStatsDialog from './LifetimeStatsDialog';
import dataService from '../services/dataService';

function Leaderboard({ players }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const activePlayers = players.filter(player => player.active);
  const inactivePlayers = players.filter(player => !player.active);

  const handlePlayerDoubleClick = (playerName) => {
    const fullPlayerData = dataService.players[playerName];
    setSelectedPlayer(fullPlayerData);
  };

  return (
    <div className="Leaderboard">
      <table>
        <thead>
          <tr>
            <th>Player Name</th>
            <th>Score</th>
            <th>W/L Ratio</th>
          </tr>
        </thead>
        <tbody>
          {activePlayers.map((player) => (
            <tr key={player.name} onDoubleClick={() => handlePlayerDoubleClick(player.name)}>
              <td>{player.name}</td>
              <td>{player.score}</td>
              <td>{player.ratio}</td>
            </tr>
          ))}
          {inactivePlayers.map((player) => (
            <tr key={player.name} className="inactive" onDoubleClick={() => handlePlayerDoubleClick(player.name)}>
              <td>{player.name}</td>
              <td>{player.score}</td>
              <td>{player.ratio}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedPlayer && (
        <LifetimeStatsDialog 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)} 
        />
      )}
    </div>
  );
}

export default Leaderboard;
