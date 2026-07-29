import React, { useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './LifetimeStatsDialog.css';

/**
 * Per-player lifetime stats.
 *
 * This module is lazy-loaded by Leaderboard, so the recharts import here does not
 * cost every visitor. It used to be a `require()` inside a try/catch at module
 * scope, which achieved neither: bundlers resolve require statically, so the
 * library shipped eagerly, and the catch could never fire (docs/AUDIT.md Q-11).
 */
function LifetimeStatsDialog({ player, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) onClose();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!player) return null;

  // Saves written before scoreHistory existed have no such field. This used to be
  // an unguarded .map(), so double-clicking an older player threw during render
  // and — with no error boundary — took the whole app down (docs/AUDIT.md L-12).
  const scoreHistory = Array.isArray(player.scoreHistory) ? player.scoreHistory : [];
  const chartData = scoreHistory.map((score, index) => ({ game: index + 1, score }));

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    return value !== undefined && value !== null ? value : 'N/A';
  };

  const calculateWinRate = () => {
    const total = (player.lifetimeWins || 0) + (player.lifetimeLosses || 0);
    if (total === 0) return '0%';
    return `${((player.lifetimeWins / total) * 100).toFixed(1)}%`;
  };

  const calculateYDomain = () => {
    if (scoreHistory.length === 0) return [0, 100];
    const min = Math.min(...scoreHistory);
    const max = Math.max(...scoreHistory);
    const padding = (max - min) * 0.1;
    return [Math.floor((min - padding) / 100) * 100, Math.ceil((max + padding) / 100) * 100];
  };

  const AxisTick = ({ x, y }) => (
    <g transform={`translate(${x},${y})`}>
      <line y2="6" stroke="#666" />
    </g>
  );

  return (
    <div className="lifetime-stats-dialog-overlay">
      <div ref={dialogRef} className="lifetime-stats-dialog" role="dialog" aria-modal="true">
        <h2 className="stats-title">Stats for {player.name}</h2>

        <div className="stats-grid">
          <div className="stats-card">
            <div className="stats-label">Lifetime Score</div>
            <div className="stats-value">{formatValue(player.lifetimeScore)}</div>
          </div>
          <div className="stats-card">
            <div className="stats-label">Games Played</div>
            <div className="stats-value">
              {formatValue((player.lifetimeWins || 0) + (player.lifetimeLosses || 0))}
            </div>
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
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="game"
                    tick={<AxisTick />}
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
              <p className="chart-empty">Play a few games to see a rating history.</p>
            )}
          </div>
        </div>

        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default LifetimeStatsDialog;
