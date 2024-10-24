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
  
  const winnerRank = score1 > score2 ? game.player1Rank : game.player2Rank;
  const loserRank = score1 > score2 ? game.player2Rank : game.player1Rank;

  const winnerName = winnerRank === 'Unranked' ? `${winner} (unranked)` : winner;
  const loserName = loserRank === 'Unranked' ? `${loser} (unranked)` : loser;

  const isSkunk = (winnerScore === 7 && loserScore === 0) || (winnerScore === 11 && loserScore === 1);
  const actionWord = isSkunk ? "skunked" : "beat";

  let message = `<b>${winnerName}</b> ${actionWord} <b>${loserName}</b> <b>[${winnerScore} - ${loserScore}]</b>`;

  // Add score changes only if both players are ranked
  if (game.player1Rank !== 'Unranked' && game.player2Rank !== 'Unranked') {
    const winnerChange = score1 > score2 ? game.pointChange1 : game.pointChange2;
    const loserChange = score1 > score2 ? game.pointChange2 : game.pointChange1;
    const winnerChangeText = winnerChange > 0 ? `+${winnerChange.toFixed(2)}` : winnerChange.toFixed(2);
    const loserChangeText = loserChange > 0 ? `+${loserChange.toFixed(2)}` : loserChange.toFixed(2);
    message += ` ${winnerChangeText} / ${loserChangeText}`;
  }

  return { message, isSkunk };
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
          gameHistory.map((game, index) => {
            const { message, isSkunk } = formatGameResult(game);
            return (
              <div
                key={index}
                className={`game-history-item ${isSkunk ? 'skunk' : ''}`}
              >
                <span dangerouslySetInnerHTML={{ __html: message }} />
              </div>
            );
          })
        ) : (
          <div>No game history available</div>
        )}
      </div>
    </div>
  );
}

export default GameHistory;
