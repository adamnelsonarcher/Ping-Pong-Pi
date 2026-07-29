import React, { useState, useEffect, useRef } from 'react';
import './AnimatedScore.css';

/**
 * The score, with a pulse whenever it changes.
 *
 * Remounting on every change via `key` restarts the CSS animation cleanly. The
 * previous approach cleared the class and set it again inside a 10ms setTimeout,
 * which raced React's own batching.
 */
function AnimatedScore({ score }) {
  const previous = useRef(score);
  const [direction, setDirection] = useState('');

  useEffect(() => {
    if (score === previous.current) return;
    setDirection(score > previous.current ? 'score-increase' : 'score-decrease');
    previous.current = score;
  }, [score]);

  return (
    <div key={score} className={`score ${direction}`}>
      {score}
    </div>
  );
}

export default AnimatedScore;
