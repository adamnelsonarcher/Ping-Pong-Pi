import React from 'react';
import './VictoryAnimation.css';

/**
 * Celebration overlay shown when a game ends.
 *
 * The parent owns the timing — this used to run its own 3.5s timer *and* have
 * the parent run two more, so three timers had to agree on when the animation
 * was over.
 */
function VictoryAnimation({ winner }) {
  return (
    <div className="victory-overlay" role="status" aria-live="polite">
      <div className="victory-text">{winner} wins!</div>
    </div>
  );
}

export default VictoryAnimation;
