import React, { useRef, useEffect } from 'react';
import './LifetimeStatsDialog.css';

let LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer;
try {
  ({ LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = require('recharts'));
} catch (error) {
  console.error('Failed to load recharts:', error);
}

function LifetimeStatsDialog({ player, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!player) return null;

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    return value !== undefined ? value : 'N/A';
  };

  const calculateWinRate = () => {
    const totalGames = player.lifetimeWins + player.lifetimeLosses;
    if (totalGames === 0) return '0%';
    return `${((player.lifetimeWins / totalGames) * 100).toFixed(1)}%`;
  };

  const chartData = player.scoreHistory.map((score, index) => ({
    game: index + 1,
    score: score
  }));

  const calculateYDomain = () => {
    const scores = player.scoreHistory;
    if (!scores || scores.length === 0) return [0, 100];
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const padding = (maxScore - minScore) * 0.1; // Add 10% padding
    
    // Round down to nearest 100 for min
    const minDomain = Math.floor((minScore - padding) / 100) * 100;
    // Round up to nearest 100 for max
    const maxDomain = Math.ceil((maxScore + padding) / 100) * 100;
    
    return [minDomain, maxDomain];
  };

  const CustomXAxisTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <line y2="6" stroke="#666" />
    </g>
  );

  return (
    <div className="lifetime-stats-dialog-overlay">
      <div ref={dialogRef} className="lifetime-stats-dialog">
        <h2 className="stats-title">Stats for {player.name}</h2>
        
        <div className="stats-grid">
          <div className="stats-card">
            <div className="stats-label">Lifetime Score</div>
            <div className="stats-value">{formatValue(player.lifetimeScore)}</div>
          </div>
          <div className="stats-card">
            <div className="stats-label">Games Played</div>
            <div className="stats-value">{formatValue(player.lifetimeWins + player.lifetimeLosses)}</div>
          </div>
          <div className="stats-card">
            <div className="stats-label">Win Rate</div>
            <div className="stats-value">{calculateWinRate()}</div>
          </div>
        </div>

        <div className="stats-table">
          <table>
            <tbody>
              <tr>
                <td>Wins</td>
                <td className="value-cell">{formatValue(player.lifetimeWins)}</td>
              </tr>
              <tr>
                <td>Losses</td>
                <td className="value-cell">{formatValue(player.lifetimeLosses)}</td>
              </tr>
              <tr>
                <td>Current Win Streak</td>
                <td className="value-cell">{formatValue(player.currentStreak)}</td>
              </tr>
              <tr>
                <td>Highest Win Streak</td>
                <td className="value-cell">{formatValue(player.maxWinStreak)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="chart-section">
          <h3>Score History</h3>
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
                    domain={calculateYDomain()}
                  />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p>Chart unavailable</p>
            )}
          </div>
        </div>

        <button className="close-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default LifetimeStatsDialog;
