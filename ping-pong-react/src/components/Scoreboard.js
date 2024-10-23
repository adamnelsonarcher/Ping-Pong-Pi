import React, { useState } from 'react';

function Scoreboard({ player1, player2, onGameEnd }) {
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);

  const handleScoreChange = (player, change) => {
    if (player === 'player1') {
      setPlayer1Score(Math.max(0, player1Score + change));
    } else {
      setPlayer2Score(Math.max(0, player2Score + change));
    }
  };

  const handleEndGame = () => {
    // Here you would typically update player scores, save game history, etc.
    alert(`Game ended. ${player1Score > player2Score ? player1 : player2} wins!`);
    onGameEnd();
  };

  return (
    <div className="Scoreboard">
      <h2>Scoreboard</h2>
      <div className="score-display">
        <div>
          <h3>{player1}</h3>
          <p>{player1Score}</p>
          <button onClick={() => handleScoreChange('player1', 1)}>+1</button>
          <button onClick={() => handleScoreChange('player1', -1)}>-1</button>
        </div>
        <div>
          <h3>{player2}</h3>
          <p>{player2Score}</p>
          <button onClick={() => handleScoreChange('player2', 1)}>+1</button>
          <button onClick={() => handleScoreChange('player2', -1)}>-1</button>
        </div>
      </div>
      <button onClick={handleEndGame}>End Game</button>
    </div>
  );
}

export default Scoreboard;
