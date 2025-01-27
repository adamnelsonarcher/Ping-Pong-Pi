import React, { useEffect, useRef } from 'react';
import './GameHistory.css';

const formatGameResult = (game) => {
  if (!game) {
    return { message: 'Invalid game data: game is undefined', isSkunk: false };
  }

  if (game.score === 'Quit') {
    return { message: `Game between <b>${game.player1}</b> and <b>${game.player2}</b> was quit`, isSkunk: false };
  }

  // Check if score is undefined or not a string
  if (typeof game.score !== 'string') {
    return { message: `Invalid game data for ${game.player1} vs ${game.player2}`, isSkunk: false };
  }

  const [score1, score2] = game.score.split(' - ').map(Number);
  
  // Check if scores are valid numbers
  if (isNaN(score1) || isNaN(score2)) {
    return { message: `Invalid score data for ${game.player1} vs ${game.player2}: ${game.score}`, isSkunk: false };
  }

  // Handle tie games
  if (score1 === score2) {
    return {
      message: `<b>${game.player1}</b> and <b>${game.player2}</b> tied <b>[${score1} - ${score2}]</b>`,
      isSkunk: false
    };
  }

  const winner = score1 > score2 ? game.player1 : game.player2;
  const loser = score1 > score2 ? game.player2 : game.player1;
  const winnerScore = Math.max(score1, score2);
  const loserScore = Math.min(score1, score2);
  
  const winnerRank = score1 > score2 ? game.player1Rank : game.player2Rank;
  const loserRank = score1 > score2 ? game.player2Rank : game.player1Rank;
  void(winnerRank, loserRank);

  const isSkunk = (winnerScore === 7 && loserScore === 0) || (winnerScore === 11 && loserScore === 1);
  const actionWord = isSkunk ? "skunked" : "beat";

  let message = `<b>${winner}</b> ${actionWord} <b>${loser}</b> <b>[${winnerScore} - ${loserScore}]</b>`;

  // Add score changes or placement match message
  if (game.player1Rank === 'Unranked' || game.player2Rank === 'Unranked') {
    message += `<br><span class="placement-match">placement match</span>`;
  } else {
    const winnerChange = score1 > score2 ? game.pointChange1 : game.pointChange2;
    const loserChange = score1 > score2 ? game.pointChange2 : game.pointChange1;
    const winnerChangeText = winnerChange > 0 ? `+${winnerChange.toFixed(2)}` : winnerChange.toFixed(2);
    const loserChangeText = loserChange > 0 ? `+${loserChange.toFixed(2)}` : loserChange.toFixed(2);
    message += `<br><span class="score-change">${winnerChangeText} / ${loserChangeText}</span>`;
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
