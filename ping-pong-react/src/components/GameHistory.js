import React from 'react';

function GameHistory({ gameHistory }) {
  const formatGameResult = (game) => {
    let message = `<b>${game.winner}</b> beat <b>${game.loser}</b> <b>[${game.winnerScore}-${game.loserScore}]</b>`;
    if (game.isSkunk) {
      message = `<span style='color:red;'><b>${game.winner}</b> SKUNKED <b>${game.loser}</b> <b>[${game.winnerScore}-${game.loserScore}]</span></b>`;
    }
    message += `: ${game.winnerScoreChange > 0 ? '+' : ''}${game.winnerScoreChange.toFixed(2)} / ${game.loserScoreChange.toFixed(2)}`;
    return message;
  };

  return (
    <div className="GameHistory">
      <h2>Game History</h2>
      <div className="history-container">
        {gameHistory.map((game, index) => (
          <div key={index} className="history-item" dangerouslySetInnerHTML={{ __html: formatGameResult(game) }} />
        ))}
      </div>
    </div>
  );
}

export default GameHistory;
