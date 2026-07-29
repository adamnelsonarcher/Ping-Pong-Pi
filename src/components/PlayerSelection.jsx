import { useMemo } from 'react';
import './PlayerSelection.css';

/**
 * The two player dropdowns.
 *
 * These used to carry `onKeyDown={(e) => e.preventDefault()}` to stop the digit
 * keys used as game controls from changing the selection. That also blocked
 * Enter, Space, the arrow keys, Home/End and type-ahead — every standard way to
 * operate a select — so keyboard and screen-reader users could not pick a player
 * at all (docs/AUDIT.md A-01).
 *
 * It was never needed: the game's key handler only exists while the Scoreboard is
 * mounted, and this component is only on screen when it is not.
 *
 * The component is also now fully controlled by `selectedPlayers`. It used to
 * mirror that into its own state, so a failed password left the dropdown showing
 * a player you had not authenticated as.
 */
function PlayerSelection({ players, selectedPlayers, onPlayerSelect }) {
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [players]
  );

  const renderSelect = (index) => {
    const id = `player${index + 1}`;
    return (
      <div className="player-select">
        <label htmlFor={id}>Player {index + 1}: </label>
        <select
          id={id}
          value={selectedPlayers[id] || ''}
          onChange={(e) => onPlayerSelect(e.target.value, index)}
        >
          <option value="">Select Player</option>
          {sortedPlayers.map((player) => (
            <option key={player.name} value={player.name}>
              {player.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="PlayerSelection">
      <div className="player-select-container">
        {renderSelect(0)}
        {renderSelect(1)}
      </div>
    </div>
  );
}

export default PlayerSelection;
