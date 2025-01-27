import React, { useState, useEffect } from 'react';
import './AnimatedScore.css';

function AnimatedScore({ score, index }) {
  const [animation, setAnimation] = useState('');
  const [prevScore, setPrevScore] = useState(score);

  useEffect(() => {
    if (score !== prevScore) {
      // Reset animation first to ensure it triggers again
      setAnimation('');
      setTimeout(() => {
        setAnimation(score > prevScore ? 'score-increase' : 'score-decrease');
      }, 10);
      
      const timer = setTimeout(() => setAnimation(''), 500);
      setPrevScore(score);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [score, prevScore]);

  return (
    <div className={`score ${animation}`}>
      {score}
    </div>
  );
}

export default AnimatedScore; 