import React, { useEffect } from 'react';
import './VictoryAnimation.css';

function VictoryAnimation({ winner, onAnimationEnd }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onAnimationEnd();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onAnimationEnd]);

  return (
    <div className="victory-overlay">
      <div className="victory-text">
        {winner} wins!
      </div>
    </div>
  );
}

export default VictoryAnimation; 