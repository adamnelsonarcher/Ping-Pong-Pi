import React, { useState, useEffect } from 'react';
import './Leaderboard.css';
import LifetimeStatsDialog from './LifetimeStatsDialog';
import dataService from '../services/dataService';
import { useSettings } from '../contexts/SettingsContext';

function Leaderboard({ players }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const { settings } = useSettings();
  const activePlayers = players.filter(player => player.active);
  const inactivePlayers = players.filter(player => !player.active);

  const handlePlayerDoubleClick = (playerName) => {
    const fullPlayerData = dataService.players[playerName];
    setSelectedPlayer(fullPlayerData);
  };

  const formatScore = (player) => {
    if (!player.active && settings) {
      return settings.DEFAULT_RANK;
    }
    return player.score;
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
              <td>{formatScore(player)}</td>
              <td>{player.ratio}</td>
            </tr>
          ))}
          {inactivePlayers.map((player) => (
            <tr key={player.name} className="inactive" onDoubleClick={() => handlePlayerDoubleClick(player.name)}>
              <td>{player.name}</td>
              <td>{formatScore(player)}</td>
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
