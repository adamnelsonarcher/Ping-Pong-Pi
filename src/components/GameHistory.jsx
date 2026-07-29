import { useEffect, useRef } from 'react';
import './GameHistory.css';

/** A shutout at 7, or 11-1, counts as a skunk. */
const SKUNK_SCORES = [
  { winner: 7, loser: 0 },
  { winner: 11, loser: 1 },
];

const NAME_LENGTH_SMALL = 20;
const NAME_LENGTH_SMALLER = 30;

function sizeClass(game) {
  const total = (game.player1 || '').length + (game.player2 || '').length;
  if (total > NAME_LENGTH_SMALLER) return 'very-long-names';
  if (total > NAME_LENGTH_SMALL) return 'long-names';
  return '';
}

function formatChange(value) {
  if (!Number.isFinite(value)) return '0.00';
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

/**
 * One line of match history.
 *
 * This returns JSX. It used to build an HTML string and hand it to
 * dangerouslySetInnerHTML with player names interpolated raw, so a player called
 * `<img src=x onerror=...>` executed script on every viewer's screen — and since
 * the API had no auth, that name could be injected into someone else's account
 * remotely (docs/AUDIT.md S-05).
 */
function GameHistoryItem({ game }) {
  const className = sizeClass(game);

  if (!game || !game.player1 || !game.player2) {
    return <div className="game-history-item">Invalid game data</div>;
  }

  if (game.score === 'Quit') {
    return (
      <div className={`game-history-item ${className}`}>
        <span className="game-result">
          Game between <b>{game.player1}</b> and <b>{game.player2}</b> was quit
        </span>
      </div>
    );
  }

  const [score1, score2] =
    typeof game.score === 'string' ? game.score.split(' - ').map(Number) : [NaN, NaN];

  if (!Number.isFinite(score1) || !Number.isFinite(score2)) {
    return (
      <div className={`game-history-item ${className}`}>
        <span className="game-result">
          Invalid score for <b>{game.player1}</b> vs <b>{game.player2}</b>
        </span>
      </div>
    );
  }

  // recordGame refuses to store a tie now, but old saves may contain one.
  if (score1 === score2) {
    return (
      <div className={`game-history-item ${className}`}>
        <span className="game-result">
          <b>{game.player1}</b> and <b>{game.player2}</b> tied{' '}
          <b>
            [{score1} - {score2}]
          </b>
        </span>
      </div>
    );
  }

  const p1Won = score1 > score2;
  const winner = p1Won ? game.player1 : game.player2;
  const loser = p1Won ? game.player2 : game.player1;
  const winnerScore = Math.max(score1, score2);
  const loserScore = Math.min(score1, score2);

  const isSkunk = SKUNK_SCORES.some(
    (rule) => winnerScore === rule.winner && loserScore === rule.loser
  );

  const isPlacement = game.player1Rank === 'Unranked' || game.player2Rank === 'Unranked';
  const winnerChange = p1Won ? game.pointChange1 : game.pointChange2;
  const loserChange = p1Won ? game.pointChange2 : game.pointChange1;

  return (
    <div className={`game-history-item ${isSkunk ? 'skunk' : ''} ${className}`}>
      <span className="game-result">
        <b>{winner}</b> {isSkunk ? 'skunked' : 'beat'} <b>{loser}</b>{' '}
        <b>
          [{winnerScore} - {loserScore}]
        </b>
      </span>
      {isPlacement ? (
        <span className="placement-match">placement match</span>
      ) : (
        <span className="score-change">
          {formatChange(winnerChange)} / {formatChange(loserChange)}
        </span>
      )}
    </div>
  );
}

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
            <GameHistoryItem
              key={`${game.date || 'nodate'}-${game.player1}-${game.player2}-${index}`}
              game={game}
            />
          ))
        ) : (
          <div>No game history available</div>
        )}
      </div>
    </div>
  );
}

export default GameHistory;
