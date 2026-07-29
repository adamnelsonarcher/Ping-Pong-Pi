import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Scoreboard from './Scoreboard';
import dataService from '../services/dataService';

jest.mock('../config/firebase', () => ({
  auth: { currentUser: null },
  authReady: Promise.resolve(null),
}));

let mockSettings = {};
jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: mockSettings }),
}));

const press = (key) => fireEvent.keyDown(window, { key });

async function setup({ settings = {}, ...props } = {}) {
  mockSettings = { DISABLE_WIN_ANIMATION: true, ...settings };

  dataService.setLocalMode(true);
  dataService.players = {};
  dataService.gameHistory = [];
  dataService.settings = { ...dataService.defaultSettings };
  await dataService.addPlayer('Alice', '');
  await dataService.addPlayer('Bob', '');

  const onGameEnd = jest.fn();
  const onQuitGame = jest.fn();
  render(
    <Scoreboard
      player1="Alice"
      player2="Bob"
      onGameEnd={onGameEnd}
      onQuitGame={onQuitGame}
      {...props}
    />
  );
  return { onGameEnd, onQuitGame };
}

beforeEach(() => {
  localStorage.clear();
  jest.useRealTimers();
});

afterEach(() => {
  dataService.dispose();
  dataService._disposed = false;
  dataService._saveTimer = null;
});

describe('Scoreboard scoring', () => {
  it('maps the keypad to the right player', async () => {
    await setup();
    press('7');
    press('7');
    press('4');

    const scores = [...document.querySelectorAll('.score')].map((el) => el.textContent);
    expect(scores).toEqual(['2', '1']);
  });

  it('will not go below zero', async () => {
    await setup();
    press('8');
    press('8');
    expect(document.querySelectorAll('.score')[0].textContent).toBe('0');
  });

  it('applies the configured scoreboard colours', async () => {
    // docs/AUDIT.md L-05 — these settings existed everywhere but here.
    await setup({
      settings: {
        PLAYER1_SCOREBOARD_COLOR: '#ff0000',
        PLAYER2_SCOREBOARD_COLOR: '#0000ff',
      },
    });

    const panels = [...document.querySelectorAll('.player-score')];
    expect(panels[0]).toHaveStyle({ backgroundColor: '#ff0000' });
    expect(panels[1]).toHaveStyle({ backgroundColor: '#0000ff' });
  });
});

describe('ending a game', () => {
  /** docs/AUDIT.md L-06 */
  it('refuses a tie and says why', async () => {
    const { onGameEnd } = await setup();
    press('7');
    press('4');

    fireEvent.click(screen.getByText('End Game'));

    expect(await screen.findByText(/cannot end in a tie/i)).toBeInTheDocument();
    expect(onGameEnd).not.toHaveBeenCalled();
    expect(dataService.gameHistory).toHaveLength(0);
  });

  it('refuses a game with no score', async () => {
    const { onGameEnd } = await setup();
    fireEvent.click(screen.getByText('End Game'));
    expect(onGameEnd).not.toHaveBeenCalled();
  });

  it('records a decided game', async () => {
    const { onGameEnd } = await setup();
    for (let i = 0; i < 11; i += 1) press('7');
    for (let i = 0; i < 4; i += 1) press('4');

    await act(async () => {
      fireEvent.click(screen.getByText('End Game'));
    });

    expect(dataService.gameHistory).toHaveLength(1);
    expect(dataService.gameHistory[0].score).toBe('11 - 4');
    expect(onGameEnd).toHaveBeenCalled();
  });

  /**
   * docs/AUDIT.md L-07 — the key handler stayed live through the victory
   * animation, so pressing "1" twice during it recorded the whole match again.
   */
  it('records the game only once however hard End is pressed', async () => {
    const { onGameEnd } = await setup();
    for (let i = 0; i < 11; i += 1) press('7');
    for (let i = 0; i < 4; i += 1) press('4');

    await act(async () => {
      fireEvent.click(screen.getByText('End Game'));
      fireEvent.click(screen.getByText('End Game'));
      fireEvent.click(screen.getByText('End Game'));
      press('1');
      press('1');
      press('1');
      press('1');
    });

    expect(dataService.gameHistory).toHaveLength(1);
    expect(onGameEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores further scoring once the game is over', async () => {
    await setup();
    for (let i = 0; i < 11; i += 1) press('7');
    for (let i = 0; i < 4; i += 1) press('4');

    await act(async () => {
      fireEvent.click(screen.getByText('End Game'));
    });

    press('7');
    expect(dataService.gameHistory[0].score).toBe('11 - 4');
  });
});

describe('quitting a game', () => {
  /**
   * docs/AUDIT.md L-01 — Quit used to call a broken network path, swallow the
   * error and return null, so the callback never fired and the user was stuck
   * on the scoreboard with no way back except reloading the page.
   */
  it('returns to the caller and records an abandoned game', async () => {
    const { onQuitGame } = await setup();
    press('7');

    await act(async () => {
      fireEvent.click(screen.getByText('Quit Game'));
    });

    expect(onQuitGame).toHaveBeenCalledTimes(1);
    expect(dataService.gameHistory).toHaveLength(1);
    expect(dataService.gameHistory[0].score).toBe('Quit');
  });

  it('leaves both ratings untouched', async () => {
    await setup();
    const before = dataService.players.Alice.score;

    await act(async () => {
      fireEvent.click(screen.getByText('Quit Game'));
    });

    expect(dataService.players.Alice.score).toBe(before);
    expect(dataService.players.Alice.gamesPlayed).toBe(0);
  });
});

describe('two-step keyboard confirmation', () => {
  it('asks before ending, then ends on the second press', async () => {
    const { onGameEnd } = await setup();
    for (let i = 0; i < 11; i += 1) press('7');

    press('1');
    expect(screen.getByText(/Press 1 again/)).toBeInTheDocument();
    expect(onGameEnd).not.toHaveBeenCalled();

    await act(async () => {
      press('1');
    });
    expect(onGameEnd).toHaveBeenCalled();
  });

  it('asks before quitting, then quits on the second press', async () => {
    const { onQuitGame } = await setup();

    press('3');
    expect(screen.getByText(/Press 3 again/)).toBeInTheDocument();
    expect(onQuitGame).not.toHaveBeenCalled();

    await act(async () => {
      press('3');
    });
    expect(onQuitGame).toHaveBeenCalled();
  });

  it('does not confuse a pending End with a Quit', async () => {
    const { onGameEnd, onQuitGame } = await setup();
    for (let i = 0; i < 11; i += 1) press('7');

    press('1'); // arm End
    await act(async () => {
      press('3'); // switching action must re-arm, not fire
    });

    expect(onGameEnd).not.toHaveBeenCalled();
    expect(onQuitGame).not.toHaveBeenCalled();
    expect(screen.getByText(/Press 3 again/)).toBeInTheDocument();
  });
});
