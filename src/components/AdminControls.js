import React, { useState, useMemo } from 'react';
import './AdminControls.css';
import dataService from '../services/dataService';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';

const SETTING_DESCRIPTIONS = {
  SCORE_CHANGE_K_FACTOR:
    'Maximum points that can be won or lost in a game, before the point difference is factored in.',
  POINT_DIFFERENCE_WEIGHT:
    'Multiplier for the point difference at the end of a game. Increases K by the point difference times this value.',
  ACTIVITY_THRESHOLD: 'Number of games a player needs to play to become ranked/active.',
  GAME_HISTORY_KEEP:
    'Number of games to show in the game history. Older games are kept, just not displayed.',
  ADDPLAYER_ADMINONLY: "Moves the 'Add New Player' button to the admin controls section.",
  DEFAULT_RANK: 'Text shown instead of a score for unranked/inactive players.',
  PLAYER1_SCOREBOARD_COLOR: 'Colour of the scoreboard for Player 1.',
  PLAYER2_SCOREBOARD_COLOR: 'Colour of the scoreboard for Player 2.',
  DISABLE_WIN_ANIMATION: 'Disables the victory animation when a game ends.',
};

/** Never render these in the generic settings form. */
const HIDDEN_SETTINGS = ['ADMIN_PASSWORD'];

function AdminControls({ onExit, onAddPlayer, onNotify = () => {}, onAccountErased = () => {} }) {
  const { settings } = useSettings();
  const { isDarkMode, setIsDarkMode } = useTheme();

  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Local edits, applied on save. Reading `settings` straight from the context
  // means this no longer re-fetches from the server on every render — the old
  // effect re-ran on each dark-mode toggle and discarded whatever you had typed
  // (docs/AUDIT.md D-04).
  const [draft, setDraft] = useState(null);
  const effective = draft ?? settings;
  const isDirty = draft !== null;

  const players = useMemo(
    () => dataService.getPlayers().sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings]
  );

  const editableSettings = Object.entries(effective).filter(
    ([key]) => !HIDDEN_SETTINGS.includes(key)
  );

  const setSetting = (key, value) => setDraft({ ...effective, [key]: value });

  const saveSettings = async () => {
    if (!isDirty) return;
    try {
      await dataService.updateSettings(draft);
      setDraft(null);
      onNotify('Settings saved.', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      onNotify('Failed to save settings.', 'error');
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
        'Reset all season scores? This affects every player, but not lifetime stats.'
      )
    ) {
      return;
    }
    await dataService.resetAllScores();
    onNotify('All season scores have been reset.', 'success');
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
      await dataService.updateSettings({ ADMIN_PASSWORD: newAdminPassword });
      setNewAdminPassword('');
      onNotify('Admin password updated.', 'success');
    } catch (error) {
      console.error('Error updating admin password:', error);
      onNotify('Failed to update admin password.', 'error');
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('Reset all settings to their defaults?')) return;
    // TIMER_INTERVAL used to be re-added here even though nothing ever read it,
    // so "Reset to Defaults" introduced a setting that did nothing
    // (docs/AUDIT.md L-08).
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

  const toggleSection = (name) =>
    setCollapsedSections((prev) => ({ ...prev, [name]: !prev[name] }));

  /** Section headers are buttons so they can be reached from the keyboard. */
  const SectionHeader = ({ name, children }) => (
    <h3>
      <button
        type="button"
        className="section-toggle"
        onClick={() => toggleSection(name)}
        aria-expanded={!collapsedSections[name]}
      >
        {children}
      </button>
    </h3>
  );

  const renderSettingInput = (key, value) => {
    if (key.includes('COLOR')) {
      return (
        <div className="color-input-container">
          <input type="color" value={value} onChange={(e) => setSetting(key, e.target.value)} />
          <input
            type="text"
            value={value}
            onChange={(e) => setSetting(key, e.target.value)}
            style={{ marginLeft: '10px' }}
          />
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => setSetting(key, e.target.checked)}
        />
      );
    }

    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setSetting(key, parseFloat(e.target.value) || 0)}
        />
      );
    }

    return <input type="text" value={value} onChange={(e) => setSetting(key, e.target.value)} />;
  };

  return (
    <div className="admin-controls">
      <h2>Admin Controls</h2>

      {effective.ADDPLAYER_ADMINONLY && (
        <div className={`admin-section ${collapsedSections.newPlayer ? 'collapsed' : ''}`}>
          <SectionHeader name="newPlayer">Add New Player</SectionHeader>
          <div className="admin-section-content">
            <button className="btn standard-btn" onClick={onAddPlayer}>
              Add New Player
            </button>
          </div>
        </div>
      )}

      <div className={`admin-section ${collapsedSections.playerManagement ? 'collapsed' : ''}`}>
        <SectionHeader name="playerManagement">Player Management</SectionHeader>
        <div className="admin-section-content">
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
            <option value="">Select Player</option>
            {players.map((player) => (
              <option key={player.name} value={player.name}>
                {player.name}
              </option>
            ))}
          </select>

          <form onSubmit={handleEditPassword}>
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" className="btn standard-btn">
              Update Password
            </button>
          </form>

          <form onSubmit={handleEditScore}>
            <input
              type="number"
              step="any"
              placeholder="New Score"
              value={newScore}
              onChange={(e) => setNewScore(e.target.value)}
            />
            <button type="submit" className="btn standard-btn">
              Update Score
            </button>
          </form>

          <div className="button-group">
            <button className="btn delete-btn" onClick={handleDeletePlayer}>
              Delete Player
            </button>
            <button className="btn reset-btn" onClick={handleResetAllScores}>
              Reset All Scores
            </button>
            <button className="btn standard-btn" onClick={handleUndoLastGame}>
              Undo Last Game
            </button>
          </div>
        </div>
      </div>

      <div className={`admin-section ${collapsedSections.adminPassword ? 'collapsed' : ''}`}>
        <SectionHeader name="adminPassword">Admin Password</SectionHeader>
        <div className="admin-section-content">
          <div className="setting-item">
            <div className="password-input-container">
              <input
                type={showAdminPassword ? 'text' : 'password'}
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="New Admin Password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowAdminPassword((v) => !v)}
                aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
              >
                {showAdminPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <button className="btn standard-btn" onClick={handleChangeAdminPassword}>
              Update Admin Password
            </button>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h3>Appearance</h3>
        <div className="admin-section-content">
          <div className="setting-item">
            <label htmlFor="theme-select">Theme</label>
            <p className="setting-description">
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
        </div>
      </div>

      <div className="admin-section">
        <h3>Game Settings</h3>
        <div className="settings-list">
          {editableSettings.map(([key, value]) => (
            <div key={key} className="setting-item">
              <label>{key.replace(/_/g, ' ')}</label>
              <p className="setting-description">{SETTING_DESCRIPTIONS[key]}</p>
              {renderSettingInput(key, value)}
            </div>
          ))}
          <div className="button-group">
            <button type="button" onClick={handleResetToDefaults} className="reset-defaults-btn">
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      <div className={`admin-section ${collapsedSections.dataManagement ? 'collapsed' : ''}`}>
        <SectionHeader name="dataManagement">Data Management</SectionHeader>
        <div className="admin-section-content">
          <div className="button-group">
            <button className="btn danger-btn" onClick={handleEraseAccount}>
              Erase Account Data
            </button>
            <button className="btn download-btn" onClick={handleDownloadData}>
              Download Save Data
            </button>
            <label className="btn upload-btn">
              Upload Save File
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleUploadData}
              />
            </label>
          </div>
        </div>
      </div>

      {/* The settings form previously had no submit button at all: the only way
          to save was this exit button, or pressing Enter inside a text field. */}
      <div className="admin-footer">
        {isDirty && <span className="unsaved-indicator">You have unsaved changes</span>}
        <button
          className="btn standard-btn"
          onClick={saveSettings}
          disabled={!isDirty}
        >
          Save Settings
        </button>
        <button
          className="btn exit-btn"
          onClick={async () => {
            if (isDirty) await saveSettings();
            onExit();
          }}
        >
          {isDirty ? 'Save and Exit' : 'Exit Admin Controls'}
        </button>
      </div>
    </div>
  );
}

export default AdminControls;
