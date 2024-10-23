import React from 'react';

function Leaderboard({ players }) {
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
          {players.map((player, index) => (
            <tr key={index} className={player.active ? '' : 'unranked'}>
              <td>{player.name}{player.currentStreak >= 3 ? ` 🔥${player.currentStreak}` : ''}</td>
              <td>{player.active ? player.score : 'Unranked'}</td>
              <td>{player.ratio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
