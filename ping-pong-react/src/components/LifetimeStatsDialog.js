import React from 'react';
import './LifetimeStatsDialog.css';

let LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer;
try {
  ({ LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = require('recharts'));
} catch (error) {
  console.error('Failed to load recharts:', error);
}

function LifetimeStatsDialog({ player, onClose }) {
  if (!player) return null;

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    return value !== undefined ? value : 'N/A';
  };

  const chartData = player.scoreHistory.map((score, index) => ({
    game: index + 1,
    score: score
  }));

  const CustomXAxisTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <line y2="6" stroke="#666" />
    </g>
  );

  return (
    <div className="lifetime-stats-overlay">
      <div className="lifetime-stats-dialog">
        <h2>Lifetime Stats for {player.name}</h2>
        <div className="stats-info">
          <p>Lifetime Score: {formatValue(player.lifetimeScore)}</p>
          <p>Total Games Played: {formatValue(player.lifetimeGamesPlayed)}</p>
          <p>Wins: {formatValue(player.lifetimeWins)}</p>
          <p>Losses: {formatValue(player.lifetimeLosses)}</p>
          <p>Highest Win Streak: {formatValue(player.maxWinStreak)}</p>
        </div>
        <p><b>Lifetime Score</b></p>
        <div className="stats-chart">
          {LineChart ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="game" 
                  tick={<CustomXAxisTick />}
                  interval={0}
                  tickSize={0}
                  axisLine={{ stroke: '#666' }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#8884d8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>Chart unavailable</p>
          )}
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default LifetimeStatsDialog;
