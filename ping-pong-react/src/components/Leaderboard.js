import React, { useState } from 'react';

function Leaderboard({ players }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  return (
    <div className="Leaderboard">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>W/L</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr 
              key={index} 
              onClick={() => setSelectedPlayer(player.name)}
              className={`${selectedPlayer === player.name ? 'selected' : ''} ${player.gamesPlayed < 3 ? 'unranked' : ''}`}
            >
              <td>{player.name}</td>
              <td>{player.gamesPlayed < 3 ? 'Unranked' : player.score}</td>
              <td>{player.ratio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
