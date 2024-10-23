import React, { useState } from 'react';

function GameHistory({ gameHistory }) {
  const [selectedGame, setSelectedGame] = useState(null);

  const formatGameResult = (game) => {
    let message = `${game.winner.name} beat ${game.loser.name} [${game.winnerScore}-${game.loserScore}]`;
    if (game.isSkunk) {
      message = `${game.winner.name} SKUNKED ${game.loser.name} [${game.winnerScore}-${game.loserScore}]`;
    }
    if (game.winnerScoreChange !== undefined && game.loserScoreChange !== undefined) {
      message += `: ${game.winnerScoreChange > 0 ? '+' : ''}${game.winnerScoreChange.toFixed(2)} / ${game.loserScoreChange.toFixed(2)}`;
    }
    return message;
  };

  return (
    <div className="GameHistory">
      <h2>Game History</h2>
      <div className="history-container">
        {gameHistory.map((game, index) => (
          <div 
            key={index} 
            className={`history-item ${selectedGame === index ? 'selected' : ''}`}
            onClick={() => setSelectedGame(index)}
          >
            {formatGameResult(game)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameHistory;
