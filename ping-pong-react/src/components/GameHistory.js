import React, { useEffect, useRef } from 'react';
import './GameHistory.css';

const formatGameResult = (game) => {
  if (!game) {
    return 'Invalid game data: game is undefined';
  }

  if (game.score === 'Quit') {
    return `Game between <b>${game.player1}</b> and <b>${game.player2}</b> was quit`;
  }

  const [score1, score2] = game.score.split(' - ').map(Number);
  const winner = score1 > score2 ? game.player1 : game.player2;
  const loser = score1 > score2 ? game.player2 : game.player1;
  const winnerScore = Math.max(score1, score2);
  const loserScore = Math.min(score1, score2);
  const winnerChange = score1 > score2 ? game.pointChange1 : game.pointChange2;
  const loserChange = score1 > score2 ? game.pointChange2 : game.pointChange1;

  // Basic message (can be customized later)
  let message = `<b>${winner}</b> beat <b>${loser}</b> <b>[${winnerScore} - ${loserScore}]</b>`;

  // Add score changes if available
  if (typeof winnerChange === 'number' && typeof loserChange === 'number') {
    const winnerChangeText = winnerChange > 0 ? `+${winnerChange.toFixed(2)}` : winnerChange.toFixed(2);
    const loserChangeText = loserChange > 0 ? `+${loserChange.toFixed(2)}` : loserChange.toFixed(2);
    message += ` ${winnerChangeText} / ${loserChangeText}`;
  }

  return message;
};

function GameHistory({ gameHistory }) {
  const historyListRef = useRef(null);

  useEffect(() => {
    if (historyListRef.current) {
      historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
    }
  }, [gameHistory]);

  return (
    <div className="game-history">
      <h2>Game History</h2>
      <div className="game-history-list" ref={historyListRef}>
        {gameHistory && gameHistory.length > 0 ? (
          gameHistory.map((game, index) => (
            <div
              key={index}
              className="game-history-item"
            >
              <span dangerouslySetInnerHTML={{ __html: formatGameResult(game) }} />
            </div>
          ))
        ) : (
          <div>No game history available</div>
        )}
      </div>
    </div>
  );
}

export default GameHistory;
