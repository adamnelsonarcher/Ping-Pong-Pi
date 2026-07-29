import React from 'react';
import { render, screen } from '@testing-library/react';
import GameHistory from './GameHistory';

const game = (overrides = {}) => ({
  id: 'g1',
  player1: 'Alice',
  player2: 'Bob',
  score: '11 - 4',
  player1Rank: 1,
  player2Rank: 2,
  pointChange1: 21.44,
  pointChange2: -21.44,
  date: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('GameHistory', () => {
  /**
   * The regression test for docs/AUDIT.md S-05.
   *
   * This component used to build an HTML string with player names interpolated
   * raw and hand it to dangerouslySetInnerHTML, so a player named
   * `<img src=x onerror=...>` executed script on every viewer's screen. Combined
   * with the unauthenticated API, that name could be injected into someone
   * else's account remotely.
   */
  describe('player names are never treated as markup', () => {
    const payload = '<img src=x onerror="window.__xssFired = true">';

    afterEach(() => {
      delete window.__xssFired;
    });

    it('renders an injected tag as text, not as an element', () => {
      const { container } = render(
        <GameHistory gameHistory={[game({ player1: payload })]} />
      );

      expect(container.querySelector('img')).toBeNull();
      expect(window.__xssFired).toBeUndefined();
      expect(screen.getByText(payload)).toBeInTheDocument();
    });

    it('escapes markup in the quit message too', () => {
      const { container } = render(
        <GameHistory gameHistory={[game({ player2: payload, score: 'Quit' })]} />
      );
      expect(container.querySelector('img')).toBeNull();
      expect(window.__xssFired).toBeUndefined();
    });

    it('escapes markup in the invalid-data path', () => {
      const { container } = render(
        <GameHistory gameHistory={[game({ player1: payload, score: 'nonsense' })]} />
      );
      expect(container.querySelector('img')).toBeNull();
      expect(window.__xssFired).toBeUndefined();
    });
  });

  it('names the winner and the margin', () => {
    render(<GameHistory gameHistory={[game()]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/beat/)).toBeInTheDocument();
    expect(screen.getByText('[11 - 4]')).toBeInTheDocument();
  });

  it('reads the winner from the score, not from the field order', () => {
    render(<GameHistory gameHistory={[game({ score: '4 - 11' })]} />);
    // Bob won despite being player2.
    const item = document.querySelector('.game-history-item');
    expect(item.textContent).toMatch(/Bob beat Alice/);
  });

  it('marks a skunk', () => {
    render(<GameHistory gameHistory={[game({ score: '7 - 0' })]} />);
    expect(screen.getByText(/skunked/)).toBeInTheDocument();
    expect(document.querySelector('.game-history-item.skunk')).toBeInTheDocument();
  });

  it('shows rating changes for a ranked match', () => {
    render(<GameHistory gameHistory={[game()]} />);
    expect(screen.getByText('+21.44 / -21.44')).toBeInTheDocument();
  });

  it('calls an unranked match a placement match instead', () => {
    render(<GameHistory gameHistory={[game({ player1Rank: 'Unranked' })]} />);
    expect(screen.getByText('placement match')).toBeInTheDocument();
  });

  it('renders an abandoned game without inventing a winner', () => {
    render(<GameHistory gameHistory={[game({ score: 'Quit' })]} />);
    expect(screen.getByText(/was quit/)).toBeInTheDocument();
    expect(screen.queryByText(/beat/)).toBeNull();
  });

  it('still renders a tie from an older save', () => {
    // recordGame refuses to store one now, but historical data may contain it.
    render(<GameHistory gameHistory={[game({ score: '9 - 9' })]} />);
    expect(screen.getByText(/tied/)).toBeInTheDocument();
  });

  it('says so when there is nothing to show', () => {
    render(<GameHistory gameHistory={[]} />);
    expect(screen.getByText('No game history available')).toBeInTheDocument();
  });

  it('survives a malformed entry rather than crashing', () => {
    render(<GameHistory gameHistory={[{ id: 'x' }]} />);
    expect(screen.getByText('Invalid game data')).toBeInTheDocument();
  });
});
