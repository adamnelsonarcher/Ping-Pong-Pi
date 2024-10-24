import React, { useState, useEffect, useRef } from 'react';
import './GameHistory.css';

const formatGameResult = (game) => {
  if (!game) {
    return 'Invalid game data: game is undefined';
  }

  if (game.score === 'Quit') {
    return `Game between <b>${game.player1}</b> and <b>${game.player2}</b> was quit without a winner`;
  }

  const [winnerScore, loserScore] = game.score.split('-').map(Number);
  const [winner, loser] = winnerScore > loserScore 
    ? [game.player1, game.player2] 
    : [game.player2, game.player1];
  
  const winnerChange = game.player1 === winner ? game.pointChange1 : game.pointChange2;
  const loserChange = game.player1 === loser ? game.pointChange1 : game.pointChange2;

  return `<b>${winner}</b> beat <b>${loser}</b> <b>[${game.score}]</b>: ${winnerChange.toFixed(2)} / ${loserChange.toFixed(2)}`;
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
