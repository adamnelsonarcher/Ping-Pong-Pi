import React, { useState, useEffect } from 'react';
import settings from '../settings';

function Scoreboard({ player1, player2, onGameEnd }) {
  const [scores, setScores] = useState([0, 0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleScoreChange = (playerIndex, change) => {
    const newScores = [...scores];
    newScores[playerIndex] = Math.max(0, newScores[playerIndex] + change);
    setScores(newScores);
  };

  const handleEndGame = () => {
    onGameEnd(player1, player2, scores[0], scores[1]);
  };

  const handleQuitGame = () => {
    onGameEnd(null, null, 0, 0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const showTempMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleKeyPress = (event) => {
    switch (event.key) {
      case '1': handleEndGame(); break;
      case '2': showTempMessage('Starting new game'); break;
      case '3': handleQuitGame(); break;
      case '4': handleScoreChange(1, 1); break;
      case '5': handleScoreChange(1, -1); break;
      case '7': handleScoreChange(0, 1); break;
      case '8': handleScoreChange(0, -1); break;
      default: break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [scores]);

  return (
    <div className="Scoreboard" tabIndex="0">
      <div className="score-container">
        {[player1, player2].map((player, index) => (
          <div key={player} className={`player-score ${index === 0 ? 'green' : 'blue'}`}>
            <div className="player-name">{player}</div>
            <div className="score">{scores[index]}</div>
            <div className="score-buttons">
              <button className="score-btn plus" onClick={() => handleScoreChange(index, 1)}>+1</button>
              <button className="score-btn minus" onClick={() => handleScoreChange(index, -1)}>-1</button>
            </div>
          </div>
        ))}
      </div>
      <div className="game-controls">
        <button className="game-btn controls" onClick={toggleControls}>Controls</button>
        <div className="center-buttons">
          <button className="game-btn end-game" onClick={handleEndGame}>End Game</button>
          <button className="game-btn quit-game" onClick={handleQuitGame}>Quit Game</button>
        </div>
        <button className="game-btn fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>
      {showControls && (
        <div className="controls-popup">
          <h3>Controls</h3>
          <p>1: End Game, 2: Start New Game, 3: Quit Game</p>
          <p>4: Player 2 +1, 5: Player 2 -1</p>
          <p>7: Player 1 +1, 8: Player 1 -1</p>
          <button onClick={toggleControls}>Close</button>
        </div>
      )}
      {message && <div className="temp-message">{message}</div>}
    </div>
  );
}

export default Scoreboard;
