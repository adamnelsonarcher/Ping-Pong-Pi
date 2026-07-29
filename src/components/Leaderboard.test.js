import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Leaderboard from './Leaderboard';
import dataService from '../services/dataService';

jest.mock('../config/firebase', () => ({
  auth: { currentUser: null },
  authReady: Promise.resolve(null),
}));

/**
 * The dialog is behind React.lazy so recharts stays out of the initial bundle
 * (docs/AUDIT.md Q-11). Jest transforms that module graph on first import, which
 * can exceed findByText's one-second default on a cold or busy machine.
 */
const LAZY_WAIT = { timeout: 15000 };

const row = (name, score, ratio, active, currentStreak = 0) => ({
  name,
  score,
  ratio,
  active,
  currentStreak,
});

describe('Leaderboard', () => {
  it('lists ranked players above unranked ones', () => {
    render(
      <Leaderboard
        players={[
          row('Alice', '1100.00', '5/1', true),
          row('Zoe', 'Unranked', '1/1', false),
        ]}
      />
    );

    const names = [...document.querySelectorAll('tbody tr td:first-child')].map(
      (td) => td.textContent
    );
    expect(names).toEqual(['Alice', 'Zoe']);
  });

  it('marks unranked players so they can be styled apart', () => {
    render(<Leaderboard players={[row('Zoe', 'Unranked', '1/1', false)]} />);
    expect(document.querySelector('tr.inactive')).toBeInTheDocument();
  });

  it('shows the score it was given rather than re-deriving it', () => {
    // getLeaderboard already resolves DEFAULT_RANK; this component used to
    // re-apply it from a second copy of the settings that could disagree.
    render(<Leaderboard players={[row('Zoe', 'Provisional', '1/1', false)]} />);
    expect(screen.getByText('Provisional')).toBeInTheDocument();
  });

  it('badges a hot streak', () => {
    render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true, 4)]} />);
    expect(screen.getByText(/🔥4/)).toBeInTheDocument();
  });

  it('does not badge a short streak', () => {
    render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true, 2)]} />);
    expect(screen.queryByText(/🔥/)).toBeNull();
  });

  it('renders a player whose name looks like markup as text', () => {
    const payload = '<b>bold</b>';
    const { container } = render(<Leaderboard players={[row(payload, '1000', '0/0', true)]} />);
    expect(container.querySelector('tbody b')).toBeNull();
    expect(screen.getByText(payload)).toBeInTheDocument();
  });

  /** docs/AUDIT.md A-04 — stats were reachable only by double-click. */
  describe('keyboard access to player stats', () => {
    beforeEach(() => {
      dataService.players = {
        Alice: {
          name: 'Alice',
          lifetimeWins: 5,
          lifetimeLosses: 1,
          lifetimeScore: 1100,
          currentStreak: 2,
          maxWinStreak: 3,
          scoreHistory: [1000, 1050, 1100],
        },
      };
      dataService.gameHistory = [];
    });

    it('exposes each row as an activatable control', () => {
      render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true)]} />);
      const tr = document.querySelector('tbody tr');

      expect(tr).toHaveAttribute('tabindex', '0');
      expect(tr).toHaveAttribute('role', 'button');
      expect(tr).toHaveAccessibleName('Show stats for Alice');
    });

    it('opens the stats dialog on Enter', async () => {
      render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true)]} />);
      fireEvent.keyDown(document.querySelector('tbody tr'), { key: 'Enter' });

      expect(await screen.findByText('Stats for Alice', {}, LAZY_WAIT)).toBeInTheDocument();
    });

    it('opens the stats dialog on Space', async () => {
      render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true)]} />);
      fireEvent.keyDown(document.querySelector('tbody tr'), { key: ' ' });

      expect(await screen.findByText('Stats for Alice', {}, LAZY_WAIT)).toBeInTheDocument();
    });

    it('ignores other keys', () => {
      render(<Leaderboard players={[row('Alice', '1100.00', '5/1', true)]} />);
      fireEvent.keyDown(document.querySelector('tbody tr'), { key: 'a' });

      expect(screen.queryByText('Stats for Alice')).toBeNull();
    });
  });
});
