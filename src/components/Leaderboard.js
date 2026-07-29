import React, { useState, Suspense, lazy } from 'react';
import './Leaderboard.css';
import dataService from '../services/dataService';

// recharts is ~500KB and is only needed when someone double-clicks a row, so it
// is split out of the initial bundle (docs/AUDIT.md Q-11). The old code wrapped a
// require() in try/catch, which does nothing — bundlers resolve require
// statically, so the whole library shipped to every visitor regardless.
const LifetimeStatsDialog = lazy(() => import('./LifetimeStatsDialog'));

/** A player is "on fire" from this many consecutive wins. */
const STREAK_BADGE_THRESHOLD = 3;

function Leaderboard({ players }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const activePlayers = players.filter((player) => player.active);
  const inactivePlayers = players.filter((player) => !player.active);

  const handlePlayerDoubleClick = (playerName) => {
    setSelectedPlayer(dataService.players[playerName] || null);
  };

  const renderRow = (player, className = '') => (
    <tr
      key={player.name}
      className={className}
      onDoubleClick={() => handlePlayerDoubleClick(player.name)}
    >
      <td>
        {player.name}
        {player.currentStreak >= STREAK_BADGE_THRESHOLD && (
          <span className="streak-badge"> 🔥{player.currentStreak}</span>
        )}
      </td>
      {/* `score` is already the display value: a fixed-point number for ranked
          players, or DEFAULT_RANK for unranked ones. It used to be re-derived
          here from a second copy of the settings, which could disagree. */}
      <td>{player.score}</td>
      <td>{player.ratio}</td>
    </tr>
  );

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
          {activePlayers.map((player) => renderRow(player))}
          {inactivePlayers.map((player) => renderRow(player, 'inactive'))}
        </tbody>
      </table>

      {selectedPlayer && (
        <Suspense fallback={null}>
          <LifetimeStatsDialog player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        </Suspense>
      )}
    </div>
  );
}

export default Leaderboard;
