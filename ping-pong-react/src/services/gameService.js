class GameResult {
  constructor(player1, player2, player1Score, player2Score) {
    this.player1 = player1;
    this.player2 = player2;
    this.player1Score = player1Score;
    this.player2Score = player2Score;
    
    if (player1Score > player2Score) {
      this.winner = player1;
      this.loser = player2;
      this.winnerScore = player1Score;
      this.loserScore = player2Score;
    } else {
      this.winner = player2;
      this.loser = player1;
      this.winnerScore = player2Score;
      this.loserScore = player1Score;
    }

    this.isSkunk = (this.winnerScore === 7 && this.loserScore === 0) || (this.winnerScore === 11 && this.loserScore === 1);

    // Calculate score changes
    this.calculateScoreChanges();
  }

  calculateScoreChanges() {
    const K = 70 + Math.abs(this.winnerScore - this.loserScore) * 6;
    this.winnerScoreChange = this.winner.calculateScoreChange(this.winner.score, this.loser.score, 1, K);
    this.loserScoreChange = this.loser.calculateScoreChange(this.loser.score, this.winner.score, 0, K);
  }
}

export default GameResult;
