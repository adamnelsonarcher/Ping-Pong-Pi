import {
  computeMatchDeltas,
  expectedScore,
  kFactor,
  isActive,
  scoreChange,
  UNRANKED_OPPONENT_K,
  DEFAULT_ACTIVITY_THRESHOLD,
} from './rating';

const SETTINGS = {
  SCORE_CHANGE_K_FACTOR: 70,
  POINT_DIFFERENCE_WEIGHT: 6,
  ACTIVITY_THRESHOLD: 3,
};

const ranked = (score, lifetimeScore = score) => ({ score, lifetimeScore, active: true });
const unranked = (score, lifetimeScore = score) => ({ score, lifetimeScore, active: false });

describe('expectedScore', () => {
  it('is 0.5 between equals', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it('favours the higher-rated player', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });

  it('is symmetric: the two expectations sum to 1', () => {
    expect(expectedScore(1337, 1024) + expectedScore(1024, 1337)).toBeCloseTo(1, 10);
  });
});

describe('kFactor', () => {
  it('scales with the margin of victory', () => {
    const close = kFactor({
      playerActive: true,
      opponentActive: true,
      pointDifference: 2,
      settings: SETTINGS,
    });
    const blowout = kFactor({
      playerActive: true,
      opponentActive: true,
      pointDifference: 11,
      settings: SETTINGS,
    });
    expect(blowout).toBeGreaterThan(close);
    expect(close).toBe(70 + 2 * 6);
  });

  it('flattens to a fixed value when a ranked player faces an unranked one', () => {
    expect(
      kFactor({
        playerActive: true,
        opponentActive: false,
        pointDifference: 11,
        settings: SETTINGS,
      })
    ).toBe(UNRANKED_OPPONENT_K);
  });

  it('lets unranked players move faster, regardless of the opponent', () => {
    const base = 70 + 2 * 6;
    const vsRanked = kFactor({
      playerActive: false,
      opponentActive: true,
      pointDifference: 2,
      settings: SETTINGS,
    });
    const vsUnranked = kFactor({
      playerActive: false,
      opponentActive: false,
      pointDifference: 2,
      settings: SETTINGS,
    });
    expect(vsRanked).toBeCloseTo(base * 1.2, 10);
    expect(vsUnranked).toBeCloseTo(base * 1.2, 10);
  });
});

describe('computeMatchDeltas', () => {
  /**
   * The regression test for docs/AUDIT.md L-02.
   *
   * The old implementation mutated the winner first and then computed the
   * loser's expectation against the winner's already-updated rating. For two
   * equal active players trading an 11-9 that produced +41.00 / -36.72 — 4.29
   * points of rating invented out of nothing, on every single match.
   */
  it('is zero-sum for evenly matched ranked players', () => {
    const { p1, p2 } = computeMatchDeltas(ranked(1000), ranked(1000), true, 2, SETTINGS);

    expect(p1.score).toBeCloseTo(41, 10);
    expect(p2.score).toBeCloseTo(-41, 10);
    expect(p1.score + p2.score).toBeCloseTo(0, 10);
  });

  it('is zero-sum across a range of rating gaps outside the upset band', () => {
    for (const [a, b] of [
      [1000, 1000],
      [1010, 1000],
      [1000, 1010],
      [1050, 1000],
    ]) {
      const { p1, p2 } = computeMatchDeltas(ranked(a), ranked(b), true, 3, SETTINGS);
      expect(p1.score + p2.score).toBeCloseTo(0, 10);
    }
  });

  it('does not depend on which player is passed first', () => {
    const forwards = computeMatchDeltas(ranked(1200), ranked(980), true, 4, SETTINGS);
    const backwards = computeMatchDeltas(ranked(980), ranked(1200), false, 4, SETTINGS);

    expect(backwards.p2.score).toBeCloseTo(forwards.p1.score, 10);
    expect(backwards.p1.score).toBeCloseTo(forwards.p2.score, 10);
  });

  /**
   * The second half of L-02: the winner's `active` flag used to flip inside their
   * own update, so the loser was then scored against a *ranked* opponent even
   * though both had gone into the match unranked. Snapshots make that impossible.
   */
  it('scores both players against the same pre-match ranked status', () => {
    const { p1, p2 } = computeMatchDeltas(unranked(1000), unranked(1000), true, 2, SETTINGS);
    expect(p1.score + p2.score).toBeCloseTo(0, 10);
  });

  it('pays an upset bonus to the underdog', () => {
    const underdog = 1000;
    const favourite = 1080;
    const expected = expectedScore(underdog, favourite);
    const k = 70 + 2 * 6;

    expect(expected).toBeLessThan(0.45); // below UPSET_WIN_THRESHOLD

    const upset = computeMatchDeltas(ranked(underdog), ranked(favourite), true, 2, SETTINGS);
    expect(upset.p1.score).toBeCloseTo(k * (1 - expected) * 1.3, 10);
  });

  /**
   * The upset bonus is the one intentional break from zero-sum, and it applies
   * only in a narrow band. Pinning both sides of that band down here so nobody
   * later mistakes it for the order-dependence bug that used to live in this
   * file (docs/AUDIT.md L-02) and "fixes" it.
   */
  it('leaks rating into the pool only when one side qualifies for the bonus', () => {
    // Gap of 80: the underdog's expectation (~0.40) is below 0.45 so they get the
    // bonus, but the favourite's (~0.60) is below 0.65 so they do not.
    const oneSided = computeMatchDeltas(ranked(1000), ranked(1080), true, 2, SETTINGS);
    expect(expectedScore(1000, 1080)).toBeGreaterThan(0.35);
    expect(oneSided.p1.score + oneSided.p2.score).toBeGreaterThan(0);

    // Gap of 400: both sides qualify, the multipliers cancel, and the match is
    // zero-sum again.
    const bothSides = computeMatchDeltas(ranked(800), ranked(1200), true, 2, SETTINGS);
    expect(expectedScore(800, 1200)).toBeLessThan(0.35);
    expect(bothSides.p1.score + bothSides.p2.score).toBeCloseTo(0, 10);
  });

  it('tracks season and lifetime ratings independently', () => {
    const { p1 } = computeMatchDeltas(
      ranked(1000, 1400),
      ranked(1000, 1000),
      true,
      2,
      SETTINGS
    );
    expect(p1.score).not.toBeCloseTo(p1.lifetimeScore, 5);
  });

  it('awards more for a bigger margin', () => {
    const close = computeMatchDeltas(ranked(1000), ranked(1000), true, 1, SETTINGS);
    const blowout = computeMatchDeltas(ranked(1000), ranked(1000), true, 11, SETTINGS);
    expect(blowout.p1.score).toBeGreaterThan(close.p1.score);
  });
});

describe('scoreChange', () => {
  it('is positive for a win and negative for a loss', () => {
    expect(scoreChange(1000, 1000, true, 40)).toBeGreaterThan(0);
    expect(scoreChange(1000, 1000, false, 40)).toBeLessThan(0);
  });
});

describe('isActive', () => {
  /** Regression test for docs/AUDIT.md L-04. */
  it('honours the configured threshold instead of a hardcoded 3', () => {
    expect(isActive(9, 10)).toBe(false);
    expect(isActive(10, 10)).toBe(true);
  });

  it('falls back to the default when the threshold is missing or nonsense', () => {
    expect(isActive(DEFAULT_ACTIVITY_THRESHOLD, undefined)).toBe(true);
    expect(isActive(DEFAULT_ACTIVITY_THRESHOLD - 1, undefined)).toBe(false);
    expect(isActive(3, NaN)).toBe(true);
  });
});
