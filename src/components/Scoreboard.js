import React, { useState, useEffect, useCallback } from 'react';
import { endGame, quitGame } from '../services/dataService';
// import { useSettings } from '../contexts/SettingsContext';

function Scoreboard({ player1, player2, onGameEnd, onQuitGame = () => {} }) {
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [message, setMessage] = useState('');
  const [endGameConfirmation, setEndGameConfirmation] = useState(false);
  const [confirmationTimer, setConfirmationTimer] = useState(null);
  const [quitGameConfirmation, setQuitGameConfirmation] = useState(false);
  const [quitConfirmationTimer] = useState(null);
  // const { settings } = useSettings();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleScoreChange = useCallback((playerIndex, change) => {
    if (playerIndex === 0) {
      setPlayer1Score(prev => Math.max(0, prev + change));
    } else {
      setPlayer2Score(prev => Math.max(0, prev + change));
    }
  }, []);

  const handleEndGameClick = useCallback(async () => {
    const result = await endGame(player1, player2, player1Score, player2Score);
    if (result) {
      onGameEnd(result);
    }
  }, [player1, player2, player1Score, player2Score, onGameEnd]);

  const handleQuitGameClick = useCallback(async () => {
    const result = await quitGame(player1, player2);
    if (result) {
      onQuitGame(result);
    }
  }, [player1, player2, onQuitGame]);

  const handleEndGameKey = useCallback(async () => {
    if (!endGameConfirmation) {
      setMessage('Press 1 again to confirm End Game');
      setEndGameConfirmation(true);
      
      if (confirmationTimer) clearTimeout(confirmationTimer);
      
      const timer = setTimeout(() => {
        setEndGameConfirmation(false);
        setMessage('');
      }, 3000);
      
      setConfirmationTimer(timer);
      return;
    }

    setEndGameConfirmation(false);
    setMessage('');
    if (confirmationTimer) clearTimeout(confirmationTimer);

    const result = await endGame(player1, player2, player1Score, player2Score);
    if (result) {
      onGameEnd(result);
    }
  }, [player1, player2, player1Score, player2Score, onGameEnd, endGameConfirmation, confirmationTimer]);

  const handleQuitGameKey = useCallback(async () => {
    if (!quitGameConfirmation) {
      setMessage('Press 3 again to confirm Quit Game');
      setQuitGameConfirmation(true);
      
      if (confirmationTimer) clearTimeout(confirmationTimer);
      
      const timer = setTimeout(() => {
        setQuitGameConfirmation(false);
        setMessage('');
      }, 3000);
      
      setConfirmationTimer(timer);
      return;
    }

    setQuitGameConfirmation(false);
    setMessage('');
    if (confirmationTimer) clearTimeout(confirmationTimer);

    const result = await quitGame(player1, player2);
    if (result) {
      onQuitGame(result);
    }
  }, [player1, player2, onQuitGame, quitGameConfirmation, confirmationTimer]);

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

  const showTempMessage = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  }, []);

  const handleKeyPress = useCallback((event) => {
    switch (event.key) {
      case '1': handleEndGameKey(); break;
      case '2': showTempMessage('Starting new game (placeholder)'); break;
      case '3': handleQuitGameKey(); break;
      case '4': handleScoreChange(1, 1); break;
      case '5': handleScoreChange(1, -1); break;
      case '7': handleScoreChange(0, 1); break;
      case '8': handleScoreChange(0, -1); break;
      default: break;
    }
  }, [handleEndGameKey, handleQuitGameKey, handleScoreChange, showTempMessage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Clean up both timers on component unmount
  useEffect(() => {
    return () => {
      if (confirmationTimer) clearTimeout(confirmationTimer);
      if (quitConfirmationTimer) clearTimeout(quitConfirmationTimer);
    };
  }, [confirmationTimer, quitConfirmationTimer]);

  return (
    <div className="Scoreboard game-transition-enter" tabIndex="0">
      <div className="score-container">
        {[player1, player2].map((player, index) => (
          <div key={player} className={`player-score ${index === 0 ? 'green' : 'blue'}`}>
            <div className="player-name">{player}</div>
            <div className="score">{index === 0 ? player1Score : player2Score}</div>
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
          <button className="game-btn end-game" onClick={handleEndGameClick}>End Game</button>
          <button className="game-btn quit-game" onClick={handleQuitGameClick}>Quit Game</button>
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
      {message && <div className="temp-message confirmation-message">{message}</div>}
    </div>
  );
}

export default Scoreboard;
