import { useState, useEffect, useCallback, useRef } from 'react';
import dataService from '../services/dataService';
import AnimatedScore from './AnimatedScore';
import VictoryAnimation from './VictoryAnimation';
import { useSettings } from '../contexts/SettingsContext';

const VICTORY_DURATION = 3500;
const CONFIRMATION_TIMEOUT = 3000;

function Scoreboard({ player1, player2, onGameEnd, onQuitGame = () => {}, onNotify = () => {} }) {
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [showVictory, setShowVictory] = useState(false);
  const [winner, setWinner] = useState(null);
  const { settings } = useSettings();

  const confirmationTimer = useRef(null);
  const messageTimer = useRef(null);
  // Once the game is ending, ignore further end/quit input. Without this, the
  // keyboard handler stays live through the 3.5s victory animation and pressing
  // "1" twice records the whole match a second time (docs/AUDIT.md L-07).
  const isFinishing = useRef(false);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(confirmationTimer.current);
      clearTimeout(messageTimer.current);
    },
    []
  );

  const showTempMessage = useCallback((text, duration = 2000) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), duration);
  }, []);

  const handleScoreChange = useCallback((playerIndex, change) => {
    if (isFinishing.current) return;
    const setter = playerIndex === 0 ? setPlayer1Score : setPlayer2Score;
    setter((prev) => Math.max(0, prev + change));
  }, []);

  const finishGame = useCallback(async () => {
    if (isFinishing.current) return;

    const result = dataService.recordGame(player1, player2, player1Score, player2Score);
    if (!result.ok) {
      // Ties and 0-0 used to be recorded, silently handing the win to player 2
      // (docs/AUDIT.md L-06).
      showTempMessage(result.reason, 3000);
      return;
    }

    isFinishing.current = true;

    if (settings?.DISABLE_WIN_ANIMATION) {
      onGameEnd(result.game);
      return;
    }

    setWinner(player1Score > player2Score ? player1 : player2);
    setShowVictory(true);
    setTimeout(() => {
      setShowVictory(false);
      onGameEnd(result.game);
    }, VICTORY_DURATION);
  }, [player1, player2, player1Score, player2Score, onGameEnd, settings, showTempMessage]);

  const abandonGame = useCallback(() => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    const game = dataService.quitGame(player1, player2);
    onQuitGame(game);
  }, [player1, player2, onQuitGame]);

  /**
   * Two-step confirmation shared by End and Quit.
   *
   * These used to keep separate state, one half of which was a useState with no
   * setter and so permanently null.
   */
  const requestConfirmation = useCallback(
    (action, prompt, perform) => {
      if (isFinishing.current) return;

      clearTimeout(confirmationTimer.current);

      if (pendingConfirmation !== action) {
        setPendingConfirmation(action);
        setMessage(prompt);
        confirmationTimer.current = setTimeout(() => {
          setPendingConfirmation(null);
          setMessage('');
        }, CONFIRMATION_TIMEOUT);
        return;
      }

      setPendingConfirmation(null);
      setMessage('');
      perform();
    },
    [pendingConfirmation]
  );

  const handleEndGameKey = useCallback(
    () => requestConfirmation('end', 'Press 1 again to confirm End Game', finishGame),
    [requestConfirmation, finishGame]
  );

  const handleQuitGameKey = useCallback(
    () => requestConfirmation('quit', 'Press 3 again to confirm Quit Game', abandonGame),
    [requestConfirmation, abandonGame]
  );

  const handleKeyPress = useCallback(
    (event) => {
      switch (event.key) {
        case '1':
          handleEndGameKey();
          break;
        case '3':
          handleQuitGameKey();
          break;
        case '4':
          handleScoreChange(1, 1);
          break;
        case '5':
          handleScoreChange(1, -1);
          break;
        case '7':
          handleScoreChange(0, 1);
          break;
        case '8':
          handleScoreChange(0, -1);
          break;
        default:
          break;
      }
    },
    [handleEndGameKey, handleQuitGameKey, handleScoreChange]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        onNotify(`Could not enter fullscreen: ${err.message}`, 'error');
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  // The colour settings existed everywhere except in the component that draws
  // the scoreboard, which hardcoded green and blue (docs/AUDIT.md L-05).
  const playerColors = [
    settings?.PLAYER1_SCOREBOARD_COLOR || '#4CAF50',
    settings?.PLAYER2_SCOREBOARD_COLOR || '#2196F3',
  ];

  return (
    <div className="Scoreboard game-transition-enter" tabIndex="0">
      <div className="score-container">
        {[player1, player2].map((player, index) => (
          <div
            key={`player-${index}`}
            className="player-score"
            style={{ backgroundColor: playerColors[index] }}
          >
            <div className="player-name">{player}</div>
            <AnimatedScore score={index === 0 ? player1Score : player2Score} />
            <div className="score-buttons">
              <button className="score-btn plus" onClick={() => handleScoreChange(index, 1)}>
                +1
              </button>
              <button className="score-btn minus" onClick={() => handleScoreChange(index, -1)}>
                -1
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="game-controls">
        <button className="game-btn controls" onClick={() => setShowControls((v) => !v)}>
          Controls
        </button>
        <div className="center-buttons">
          <button className="game-btn end-game" onClick={finishGame}>
            End Game
          </button>
          <button className="game-btn quit-game" onClick={abandonGame}>
            Quit Game
          </button>
        </div>
        <button className="game-btn fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {showControls && (
        <div className="controls-popup">
          <h3>Controls</h3>
          <p>1: End Game, 3: Quit Game</p>
          <p>4: Player 2 +1, 5: Player 2 -1</p>
          <p>7: Player 1 +1, 8: Player 1 -1</p>
          <button onClick={() => setShowControls(false)}>Close</button>
        </div>
      )}

      {message && <div className="temp-message confirmation-message">{message}</div>}
      {showVictory && <VictoryAnimation winner={winner} />}
    </div>
  );
}

export default Scoreboard;
