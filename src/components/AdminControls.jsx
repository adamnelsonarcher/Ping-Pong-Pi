import React, { useState, useMemo } from 'react';
import './AdminControls.css';
import dataService from '../services/dataService';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';

// Readable names for the raw setting keys, so the form does not shout
// "SCORE CHANGE K FACTOR" at you.
const SETTING_LABELS = {
  SCORE_CHANGE_K_FACTOR: 'K-factor',
  POINT_DIFFERENCE_WEIGHT: 'Point-difference weight',
  ACTIVITY_THRESHOLD: 'Games to become ranked',
  GAME_HISTORY_KEEP: 'Games shown in history',
  ADDPLAYER_ADMINONLY: 'Add players from admin only',
  DEFAULT_RANK: 'Unranked label',
  PLAYER1_SCOREBOARD_COLOR: 'Player 1 colour',
  PLAYER2_SCOREBOARD_COLOR: 'Player 2 colour',
  DISABLE_WIN_ANIMATION: 'Disable win animation',
};

const SETTING_DESCRIPTIONS = {
  SCORE_CHANGE_K_FACTOR:
    'Maximum points that can be won or lost in a game, before the point difference is factored in.',
  POINT_DIFFERENCE_WEIGHT:
    'Multiplier for the point difference at the end of a game. Increases K by the point difference times this value.',
  ACTIVITY_THRESHOLD: 'Number of games a player needs to play to become ranked/active.',
  GAME_HISTORY_KEEP:
    'How many games the history shows. Older games are kept, just not displayed.',
  ADDPLAYER_ADMINONLY: 'Moves the "Add Player" button off the main screen and into here.',
  DEFAULT_RANK: 'Text shown instead of a score for unranked players.',
  PLAYER1_SCOREBOARD_COLOR: 'Colour of the scoreboard for Player 1.',
  PLAYER2_SCOREBOARD_COLOR: 'Colour of the scoreboard for Player 2.',
  DISABLE_WIN_ANIMATION: 'Turns off the victory animation when a game ends.',
};

/** Never render this in the generic settings form; it has its own section. */
const HIDDEN_SETTINGS = ['ADMIN_PASSWORD'];

const labelFor = (key) => SETTING_LABELS[key] || key.replace(/_/g, ' ').toLowerCase();

function AdminControls({ onExit, onAddPlayer, onNotify = () => {}, onAccountErased = () => {} }) {
  const { settings } = useSettings();
  const { isDarkMode, setIsDarkMode } = useTheme();

  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Settings edits are held in a draft and applied on Save. Reading `settings`
  // straight from the context (rather than re-fetching) is what stopped the old
  // panel from discarding your edits on a dark-mode toggle (docs/AUDIT.md D-04).
  const [draft, setDraft] = useState(null);
  const effective = draft ?? settings;
  const isDirty = draft !== null;

  const players = useMemo(
    () => dataService.getPlayers().sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings]
  );

  const seasons = dataService.getSeasons();

  const editableSettings = Object.entries(effective).filter(
    ([key]) => !HIDDEN_SETTINGS.includes(key)
  );

  const setSetting = (key, value) => setDraft({ ...effective, [key]: value });

  const saveSettings = async () => {
    if (!isDirty) return true;
    try {
      await dataService.updateSettings(draft);
      setDraft(null);
      onNotify('Settings saved.', 'success');
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      onNotify('Failed to save settings.', 'error');
      return false;
    }
  };

  const handleEditPassword = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return onNotify('Select a player first.', 'error');
    if (!newPassword) return onNotify('Enter a new password.', 'error');
    await dataService.editPlayerPassword(selectedPlayer, newPassword);
    setNewPassword('');
    onNotify(`Password updated for ${selectedPlayer}.`, 'success');
  };

  const handleEditScore = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return onNotify('Select a player first.', 'error');
    const parsed = parseFloat(newScore);
    if (!Number.isFinite(parsed)) return onNotify('Enter a valid score.', 'error');
    await dataService.editPlayerScore(selectedPlayer, parsed);
    setNewScore('');
    onNotify(`Score updated for ${selectedPlayer}.`, 'success');
  };

  const handleDeletePlayer = async () => {
    if (!selectedPlayer) return onNotify('Select a player first.', 'error');
    if (!window.confirm(`Delete ${selectedPlayer}? This cannot be undone.`)) return;
    await dataService.deletePlayer(selectedPlayer);
    setSelectedPlayer('');
    onNotify('Player deleted.', 'success');
  };

  const handleResetAllScores = async () => {
    if (
      !window.confirm(
        'End the current season?\n\n' +
          'The final table is archived below and every player starts fresh. ' +
          'Lifetime stats are not affected.'
      )
    ) {
      return;
    }
    const result = await dataService.resetAllScores();
    onNotify(
      result.archived
        ? 'Season ended and archived. All season scores reset.'
        : 'All season scores have been reset.',
      'success'
    );
  };

  const handleUndoLastGame = async () => {
    const last = dataService.gameHistory[dataService.gameHistory.length - 1];
    if (!last) return onNotify('There is nothing to undo.', 'error');
    if (!window.confirm(`Undo the last game (${last.player1} vs ${last.player2})?`)) return;

    const result = dataService.undoLastGame();
    onNotify(result.ok ? 'Last game undone.' : result.reason, result.ok ? 'success' : 'error');
  };

  const handleChangeAdminPassword = async () => {
    if (newAdminPassword.length < 4) {
      return onNotify('Password must be at least 4 characters long.', 'error');
    }
    try {
      await dataService.setAdminPasswordValue(newAdminPassword);
      setNewAdminPassword('');
      onNotify('Admin password updated.', 'success');
    } catch (error) {
      console.error('Error updating admin password:', error);
      onNotify('Failed to update admin password.', 'error');
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('Reset all settings to their defaults?')) return;
    setDraft({ ...dataService.defaultSettings });
    await dataService.updateSettings(dataService.defaultSettings);
    setDraft(null);
    onNotify('Settings reset to defaults.', 'success');
  };

  const handleEraseAccount = async () => {
    if (
      !window.confirm(
        'Erase all account data? This cannot be undone.\n\n' +
          'Download a backup first if you might want it back.'
      )
    ) {
      return;
    }
    try {
      await dataService.eraseAccount();
      onAccountErased();
    } catch (error) {
      console.error('Error erasing account:', error);
      onNotify('Failed to erase account data. Please try again.', 'error');
    }
  };

  const handleDownloadData = () => {
    try {
      const blob = new Blob([JSON.stringify(dataService._serialise(), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pingpong_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading data:', error);
      onNotify('Failed to download save data.', 'error');
    }
  };

  const handleUploadData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await dataService.importAccount(JSON.parse(e.target.result));
        setDraft(null);
        onNotify('Save file loaded.', 'success');
      } catch (error) {
        console.error('Error uploading data:', error);
        onNotify('Failed to load save file. Please check it is a valid backup.', 'error');
      }
    };
    reader.readAsText(file);
    // Allow re-selecting the same file after a failure.
    event.target.value = '';
  };

  const handleExit = async () => {
    if (isDirty) {
      const ok = await saveSettings();
      if (!ok) return; // keep the user here so they don't lose the edit
    }
    onExit();
  };

  const renderSettingInput = (key, value) => {
    const id = `setting-${key}`;

    if (key.includes('COLOR')) {
      return (
        <div className="color-input">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => setSetting(key, e.target.value)}
          />
          <input
            type="text"
            value={value}
            aria-label={`${labelFor(key)} hex value`}
            onChange={(e) => setSetting(key, e.target.value)}
          />
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <label className="switch">
          <input
            id={id}
            type="checkbox"
            checked={value}
            onChange={(e) => setSetting(key, e.target.checked)}
          />
          <span>{value ? 'On' : 'Off'}</span>
        </label>
      );
    }

    if (typeof value === 'number') {
      return (
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => setSetting(key, parseFloat(e.target.value) || 0)}
        />
      );
    }

    return (
      <input id={id} type="text" value={value} onChange={(e) => setSetting(key, e.target.value)} />
    );
  };

  return (
    <div className="admin-controls">
      <header className="admin-top">
        <h2>Admin</h2>
        <button type="button" className="admin-btn subtle" onClick={handleExit}>
          {isDirty ? 'Save & close' : 'Close'}
        </button>
      </header>

      {effective.ADDPLAYER_ADMINONLY && (
        <section className="admin-section">
          <h3>Players</h3>
          <button type="button" className="admin-btn primary" onClick={onAddPlayer}>
            Add New Player
          </button>
        </section>
      )}

      <section className="admin-section">
        <h3>Player management</h3>

        <div className="admin-field">
          <label htmlFor="player-select">Player</label>
          <select
            id="player-select"
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            <option value="">Select a player…</option>
            {players.map((player) => (
              <option key={player.name} value={player.name}>
                {player.name}
              </option>
            ))}
          </select>
        </div>

        <form className="inline-field" onSubmit={handleEditPassword}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="submit" className="admin-btn primary">
            Update password
          </button>
        </form>

        <form className="inline-field" onSubmit={handleEditScore}>
          <input
            type="number"
            step="any"
            placeholder="New score"
            value={newScore}
            onChange={(e) => setNewScore(e.target.value)}
          />
          <button type="submit" className="admin-btn primary">
            Update score
          </button>
        </form>

        <div className="admin-btn-row">
          <button type="button" className="admin-btn danger" onClick={handleDeletePlayer}>
            Delete player
          </button>
          <button type="button" className="admin-btn subtle" onClick={handleUndoLastGame}>
            Undo last game
          </button>
          <button type="button" className="admin-btn subtle" onClick={handleResetAllScores}>
            End season / reset scores
          </button>
        </div>
      </section>

      <section className="admin-section">
        <h3>Game settings</h3>
        {editableSettings.map(([key, value]) => (
          <div key={key} className="admin-field">
            <label htmlFor={`setting-${key}`}>{labelFor(key)}</label>
            {SETTING_DESCRIPTIONS[key] && (
              <p className="field-help">{SETTING_DESCRIPTIONS[key]}</p>
            )}
            {renderSettingInput(key, value)}
          </div>
        ))}
        <div className="admin-btn-row">
          <button type="button" className="admin-btn subtle" onClick={handleResetToDefaults}>
            Reset to defaults
          </button>
          <button
            type="button"
            className="admin-btn primary"
            onClick={saveSettings}
            disabled={!isDirty}
          >
            Save settings
          </button>
          {isDirty && <span className="dirty-note">Unsaved changes</span>}
        </div>
      </section>

      <section className="admin-section">
        <h3>Appearance</h3>
        <div className="admin-field">
          <label htmlFor="theme-select">Theme</label>
          <p className="field-help">
            Applies to this device only, so a wall display and a phone can differ.
          </p>
          <select
            id="theme-select"
            value={isDarkMode ? 'dark' : 'light'}
            onChange={(e) => setIsDarkMode(e.target.value === 'dark')}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className="admin-section">
        <h3>Admin password</h3>
        <div className="admin-field">
          <div className="password-field">
            <input
              type={showAdminPassword ? 'text' : 'password'}
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="New admin password"
            />
            <button
              type="button"
              className="reveal-btn"
              onClick={() => setShowAdminPassword((v) => !v)}
              aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
            >
              {showAdminPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <button type="button" className="admin-btn primary" onClick={handleChangeAdminPassword}>
            Update admin password
          </button>
        </div>
      </section>

      {seasons.length > 0 && (
        <section className="admin-section">
          <h3>Past seasons</h3>
          <ul className="season-list">
            {[...seasons].reverse().map((season) => (
              <li key={season.id} className="season-entry">
                <div className="season-headline">
                  <strong>{season.name}</strong>
                  <span className="season-date">
                    ended {new Date(season.endedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="season-champion">
                  🏆 {season.champion} — {season.standings.length} ranked player
                  {season.standings.length === 1 ? '' : 's'}
                </div>
                <ol className="season-standings">
                  {season.standings.slice(0, 3).map((entry) => (
                    <li key={entry.name}>
                      {entry.name} <span className="season-score">{entry.score}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="admin-section">
        <h3>Data management</h3>
        <div className="admin-btn-row">
          <button type="button" className="admin-btn subtle" onClick={handleDownloadData}>
            Download backup
          </button>
          <label className="admin-btn subtle upload-btn">
            Upload backup
            <input type="file" accept=".json" onChange={handleUploadData} />
          </label>
          <button type="button" className="admin-btn danger" onClick={handleEraseAccount}>
            Erase account data
          </button>
        </div>
      </section>

      <div className="admin-footer">
        <button type="button" className="admin-btn primary" onClick={handleExit}>
          {isDirty ? 'Save & close' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export default AdminControls;
