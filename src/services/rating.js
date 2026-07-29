/**
 * Rating maths for Ping Pong Pi.
 *
 * Everything here is a pure function of its arguments: no I/O, no mutation of
 * inputs, no reads of module state. That is deliberate — this file is the part of
 * the app most worth testing, and the historical bugs in it (see docs/AUDIT.md
 * L-02, L-04) were only possible because the maths was tangled up with the objects
 * it mutated.
 *
 * The model is ELO with three house rules:
 *
 *   1. K scales with the margin of victory, so an 11-0 moves ratings far more
 *      than an 11-9.
 *   2. Unranked players (fewer than ACTIVITY_THRESHOLD games) move faster, so new
 *      players converge on their true rating quickly. Beating an unranked player
 *      is worth little, because their rating is not yet meaningful.
 *   3. Upsets pay a bonus.
 *
 * Rule 3 is the one intentional deviation from a strictly zero-sum system: in the
 * band where the underdog gets the bonus but the favourite is not yet penalised,
 * a match injects a few points into the pool. That is a deliberate design choice,
 * not the bug that used to live here. See computeMatchDeltas.
 */

/** Divisor in the expectation curve. Chess uses 400; 450 flattens it slightly. */
export const RATING_SCALE = 450;

/** Games needed to become "ranked" when ACTIVITY_THRESHOLD is not supplied. */
export const DEFAULT_ACTIVITY_THRESHOLD = 3;

/** Flat K applied when a ranked player beats or loses to an unranked one. */
export const UNRANKED_OPPONENT_K = 20;

/** K multiplier while you are still unranked yourself. */
export const UNRANKED_K_MULTIPLIER = 1.2;

/** Bonus multiplier on an upset. */
export const UPSET_MULTIPLIER = 1.3;

/** An upset win is one where the winner's expectation was below this. */
export const UPSET_WIN_THRESHOLD = 0.45;

/** An upset loss is one where the loser's expectation was above this. */
export const UPSET_LOSS_THRESHOLD = 0.65;

/** Lifetime rating never falls below this. */
export const MIN_LIFETIME_SCORE = 100;

/** Rating every new player starts at. */
export const STARTING_SCORE = 1000;

/**
 * Probability that a player rated `rating` beats one rated `opponentRating`.
 * Returns a number in (0, 1).
 */
export function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / RATING_SCALE));
}

/**
 * How much rating is at stake for one player in one match.
 *
 * Note the asymmetry: the two players in a match can have different K values,
 * because K depends on whether *you* are ranked, not on the match as a whole.
 */
export function kFactor({ playerActive, opponentActive, pointDifference, settings }) {
  const base =
    settings.SCORE_CHANGE_K_FACTOR + pointDifference * settings.POINT_DIFFERENCE_WEIGHT;

  if (!playerActive) return base * UNRANKED_K_MULTIPLIER;
  if (!opponentActive) return UNRANKED_OPPONENT_K;
  return base;
}

/**
 * Rating change for one player. Positive if they won.
 */
export function scoreChange(rating, opponentRating, won, k) {
  const expected = expectedScore(rating, opponentRating);
  const result = won ? 1 : 0;
  let change = k * (result - expected);

  const isUpset = won
    ? expected < UPSET_WIN_THRESHOLD
    : expected > UPSET_LOSS_THRESHOLD;
  if (isUpset) change *= UPSET_MULTIPLIER;

  return change;
}

/**
 * The rating change both players get from a single match.
 *
 * `p1` and `p2` are plain snapshots — `{ score, lifetimeScore, active }` — taken
 * *before* either player is modified. This is the whole point of the function.
 *
 * The bug this replaces (docs/AUDIT.md L-02) applied the winner's update first and
 * then computed the loser's expectation against the winner's already-updated
 * rating. Two equal players trading an 11-9 produced +41.00 / -36.72, inventing
 * 4.29 points of rating out of nothing on every match, and because the winner was
 * always updated first, winners were systematically over-rewarded.
 *
 * Reading both players from a snapshot makes the result symmetric and independent
 * of evaluation order. Outside the upset band it is exactly zero-sum.
 *
 * @param {{score:number, lifetimeScore:number, active:boolean}} p1
 * @param {{score:number, lifetimeScore:number, active:boolean}} p2
 * @param {boolean} p1Won
 * @param {number}  pointDifference  absolute margin of victory
 * @param {object}  settings         needs SCORE_CHANGE_K_FACTOR, POINT_DIFFERENCE_WEIGHT
 * @returns {{p1:{score:number,lifetimeScore:number}, p2:{score:number,lifetimeScore:number}}}
 */
export function computeMatchDeltas(p1, p2, p1Won, pointDifference, settings) {
  const k1 = kFactor({
    playerActive: p1.active,
    opponentActive: p2.active,
    pointDifference,
    settings,
  });
  const k2 = kFactor({
    playerActive: p2.active,
    opponentActive: p1.active,
    pointDifference,
    settings,
  });

  return {
    p1: {
      score: scoreChange(p1.score, p2.score, p1Won, k1),
      lifetimeScore: scoreChange(p1.lifetimeScore, p2.lifetimeScore, p1Won, k1),
    },
    p2: {
      score: scoreChange(p2.score, p1.score, !p1Won, k2),
      lifetimeScore: scoreChange(p2.lifetimeScore, p1.lifetimeScore, !p1Won, k2),
    },
  };
}

/**
 * Whether a player has played enough games to appear on the ranked leaderboard.
 *
 * The threshold used to be hardcoded to 3 here while the admin panel happily
 * offered an ACTIVITY_THRESHOLD setting that did nothing (docs/AUDIT.md L-04).
 */
export function isActive(gamesPlayed, activityThreshold = DEFAULT_ACTIVITY_THRESHOLD) {
  const threshold = Number.isFinite(activityThreshold)
    ? activityThreshold
    : DEFAULT_ACTIVITY_THRESHOLD;
  return gamesPlayed >= threshold;
}
