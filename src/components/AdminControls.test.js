import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminControls from './AdminControls';
import dataService from '../services/dataService';

jest.mock('../config/firebase', () => ({
  auth: { currentUser: null },
  authReady: Promise.resolve(null),
}));

// The panel reads settings/theme from context; provide them directly.
let mockSettings;
jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: mockSettings }),
}));
jest.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: true, setIsDarkMode: jest.fn() }),
}));

const baseSettings = () => ({
  SCORE_CHANGE_K_FACTOR: 70,
  POINT_DIFFERENCE_WEIGHT: 6,
  ACTIVITY_THRESHOLD: 3,
  DEFAULT_RANK: 'Unranked',
  PLAYER1_SCOREBOARD_COLOR: '#4CAF50',
  PLAYER2_SCOREBOARD_COLOR: '#2196F3',
  GAME_HISTORY_KEEP: 30,
  ADDPLAYER_ADMINONLY: false,
  DISABLE_WIN_ANIMATION: false,
  ADMIN_PASSWORD: 'x',
});

function setup(extraProps = {}, { seasons = [] } = {}) {
  mockSettings = baseSettings();
  dataService.setLocalMode(true);
  dataService.players = {};
  dataService.gameHistory = [];
  dataService.seasons = seasons;
  dataService.settings = baseSettings();

  const props = {
    onExit: jest.fn(),
    onAddPlayer: jest.fn(),
    onNotify: jest.fn(),
    onAccountErased: jest.fn(),
    ...extraProps,
  };
  render(<AdminControls {...props} />);
  return props;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  dataService.dispose();
  dataService._disposed = false;
  dataService._saveTimer = null;
});

describe('AdminControls layout', () => {
  it('renders flat sections with plain headers', () => {
    setup();
    const headers = [...document.querySelectorAll('.admin-section h3')].map((h) => h.textContent);
    expect(headers).toEqual(
      expect.arrayContaining([
        'Player management',
        'Game settings',
        'Appearance',
        'Admin password',
        'Data management',
      ])
    );
  });

  /**
   * Regression guard for the redesign: the panel used to be an accordion with
   * collapse toggles, nested content cards and a sticky footer. Those are gone.
   */
  it('has no collapse toggles or nested content containers', () => {
    setup();
    expect(document.querySelector('.section-toggle')).toBeNull();
    expect(document.querySelector('.admin-section-content')).toBeNull();
    expect(document.querySelector('.collapsed')).toBeNull();
  });

  it('hides the Past seasons section when there are none', () => {
    setup();
    expect(screen.queryByText('Past seasons')).toBeNull();
  });

  it('shows archived seasons when present', () => {
    setup(
      {},
      {
        seasons: [
          {
            id: 's1',
            name: 'Season 1',
            endedAt: '2026-06-01T00:00:00.000Z',
            champion: 'Alice',
            standings: [{ name: 'Alice', score: '1120.00', ratio: '8/2' }],
          },
        ],
      }
    );
    expect(screen.getByText('Past seasons')).toBeInTheDocument();
    expect(screen.getByText('Season 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
  });
});

describe('AdminControls settings', () => {
  it('renders a readable label instead of the raw key', () => {
    setup();
    expect(screen.getByText('K-factor')).toBeInTheDocument();
    expect(screen.queryByText('SCORE CHANGE K FACTOR')).toBeNull();
  });

  it('keeps Save disabled until something changes, then saves the draft', async () => {
    setup();
    const save = jest.spyOn(dataService, 'updateSettings').mockResolvedValue(true);

    const saveButton = screen.getByRole('button', { name: 'Save settings' });
    expect(saveButton).toBeDisabled();

    const kInput = screen.getByLabelText('K-factor');
    fireEvent.change(kInput, { target: { value: '55' } });

    expect(saveButton).toBeEnabled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0].SCORE_CHANGE_K_FACTOR).toBe(55);
  });

  it('does not render the admin password among the generic settings', () => {
    setup();
    // ADMIN_PASSWORD has its own section; it must not appear as an editable field.
    expect(screen.queryByLabelText(/admin.password/i)).toBeNull();
    const settingLabels = [...document.querySelectorAll('.admin-field > label')].map(
      (l) => l.textContent
    );
    expect(settingLabels).not.toContain('ADMIN_PASSWORD');
  });
});

describe('AdminControls exit', () => {
  // A Close button sits at both the top and bottom of the (potentially long)
  // panel; either exits.
  it('exits immediately when there are no unsaved changes', async () => {
    const props = setup();
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]);
    await waitFor(() => expect(props.onExit).toHaveBeenCalled());
  });

  it('saves before exiting when there are unsaved changes', async () => {
    const props = setup();
    const save = jest.spyOn(dataService, 'updateSettings').mockResolvedValue(true);

    fireEvent.change(screen.getByLabelText('K-factor'), { target: { value: '42' } });
    // "Close" becomes "Save & close" while dirty.
    fireEvent.click(screen.getAllByRole('button', { name: 'Save & close' })[0]);

    await waitFor(() => expect(props.onExit).toHaveBeenCalled());
    expect(save).toHaveBeenCalled();
  });
});
