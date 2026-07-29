import { headToHead, rivalries, biggestUpsets, summarise } from './stats';

const game = (player1, player2, score, extra = {}) => ({
  id: `${player1}-${player2}-${score}-${extra.date || ''}`,
  player1,
  player2,
  score,
  pointChange1: 10,
  pointChange2: -10,
  date: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('headToHead', () => {
  const history = [
    game('Alice', 'Bob', '11 - 4', { date: '2026-01-01T00:00:00.000Z' }),
    game('Bob', 'Alice', '11 - 9', { date: '2026-01-02T00:00:00.000Z' }),
    game('Alice', 'Bob', '11 - 7', { date: '2026-01-03T00:00:00.000Z' }),
    game('Alice', 'Carol', '11 - 2', { date: '2026-01-04T00:00:00.000Z' }),
  ];

  it('counts wins and losses from either side of the fixture', () => {
    const [bob, carol] = headToHead(history, 'Alice');

    expect(bob.opponent).toBe('Bob');
    expect(bob.played).toBe(3);
    expect(bob.wins).toBe(2);
    expect(bob.losses).toBe(1);

    expect(carol.opponent).toBe('Carol');
    expect(carol.played).toBe(1);
    expect(carol.wins).toBe(1);
  });

  it('is symmetric — the mirror of A vs B is B vs A', () => {
    const alicesView = headToHead(history, 'Alice').find((r) => r.opponent === 'Bob');
    const bobsView = headToHead(history, 'Bob').find((r) => r.opponent === 'Alice');

    expect(bobsView.wins).toBe(alicesView.losses);
    expect(bobsView.losses).toBe(alicesView.wins);
    expect(bobsView.pointsFor).toBe(alicesView.pointsAgainst);
  });

  it('totals points for and against from the right perspective', () => {
    const bob = headToHead(history, 'Alice').find((r) => r.opponent === 'Bob');
    expect(bob.pointsFor).toBe(11 + 9 + 11);
    expect(bob.pointsAgainst).toBe(4 + 11 + 7);
  });

  it('sorts by how often the pair has played', () => {
    expect(headToHead(history, 'Alice').map((r) => r.opponent)).toEqual(['Bob', 'Carol']);
  });

  it('tracks the most recent meeting', () => {
    const bob = headToHead(history, 'Alice').find((r) => r.opponent === 'Bob');
    expect(bob.lastPlayed).toBe('2026-01-03T00:00:00.000Z');
  });

  it('ignores abandoned games', () => {
    const withQuit = [...history, game('Alice', 'Bob', 'Quit')];
    const bob = headToHead(withQuit, 'Alice').find((r) => r.opponent === 'Bob');
    expect(bob.played).toBe(3);
  });

  it('copes with an empty or missing history', () => {
    expect(headToHead([], 'Alice')).toEqual([]);
    expect(headToHead(undefined, 'Alice')).toEqual([]);
  });

  it('returns nothing for a player who has not played', () => {
    expect(headToHead(history, 'Nobody')).toEqual([]);
  });
});

describe('rivalries', () => {
  it('ranks an even split above a whitewash', () => {
    const history = [
      // Alice and Bob: 2-2 over four games.
      game('Alice', 'Bob', '11 - 4'),
      game('Alice', 'Bob', '11 - 5'),
      game('Bob', 'Alice', '11 - 6'),
      game('Bob', 'Alice', '11 - 7'),
      // Carol and Dave: 4-0.
      game('Carol', 'Dave', '11 - 1'),
      game('Carol', 'Dave', '11 - 2'),
      game('Carol', 'Dave', '11 - 3'),
      game('Carol', 'Dave', '11 - 4'),
    ];

    const [top] = rivalries(history);
    expect([top.playerA, top.playerB].sort()).toEqual(['Alice', 'Bob']);
    expect(top.closeness).toBe(1);
  });

  it('treats A vs B and B vs A as the same pairing', () => {
    const history = [
      game('Alice', 'Bob', '11 - 4'),
      game('Bob', 'Alice', '11 - 5'),
      game('Alice', 'Bob', '11 - 6'),
      game('Bob', 'Alice', '11 - 7'),
    ];
    expect(rivalries(history)).toHaveLength(1);
    expect(rivalries(history)[0].played).toBe(4);
  });

  it('ignores pairings below the minimum', () => {
    const history = [game('Alice', 'Bob', '11 - 4')];
    expect(rivalries(history)).toEqual([]);
    expect(rivalries(history, { minimumGames: 1 })).toHaveLength(1);
  });
});

describe('biggestUpsets', () => {
  it('ranks by the size of the winner\'s rating swing', () => {
    const history = [
      game('Alice', 'Bob', '11 - 9', { pointChange1: 12, pointChange2: -12 }),
      game('Carol', 'Dave', '11 - 0', { pointChange1: 71, pointChange2: -71 }),
      game('Eve', 'Frank', '11 - 5', { pointChange1: 30, pointChange2: -30 }),
    ];

    const [first, second] = biggestUpsets(history);
    expect(first.winner).toBe('Carol');
    expect(first.swing).toBe(71);
    expect(second.winner).toBe('Eve');
  });

  it('reads the swing from the winner even when they were player 2', () => {
    const history = [game('Alice', 'Bob', '4 - 11', { pointChange1: -55, pointChange2: 55 })];
    const [top] = biggestUpsets(history);
    expect(top.winner).toBe('Bob');
    expect(top.loser).toBe('Alice');
    expect(top.swing).toBe(55);
  });

  it('skips abandoned games', () => {
    expect(biggestUpsets([game('Alice', 'Bob', 'Quit')])).toEqual([]);
  });
});

describe('summarise', () => {
  it('separates played from abandoned', () => {
    const history = [
      game('Alice', 'Bob', '11 - 4', { date: '2026-01-01T00:00:00.000Z' }),
      game('Alice', 'Bob', 'Quit', { date: '2026-01-02T00:00:00.000Z' }),
      game('Alice', 'Bob', '11 - 6', { date: '2026-01-03T00:00:00.000Z' }),
    ];
    expect(summarise(history)).toMatchObject({ total: 3, played: 2, quit: 1 });
  });

  it('handles an empty history', () => {
    expect(summarise([])).toMatchObject({ total: 0, played: 0, quit: 0 });
  });
});
