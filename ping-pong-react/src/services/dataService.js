import Player from './playerService';
import GameResult from './gameService';

class DataService {
  constructor() {
    this.players = {};
    this.gameHistory = [];
  }

  async loadData() {
    await this.loadPlayers();
    await this.loadGameHistory();
  }

  async loadPlayers() {
    try {
      const response = await fetch('/data/players.json');
      const playerData = await response.json();
      playerData.forEach(data => {
        const player = new Player(data.name, data.score, data.password);
        player.gamesPlayed = data.gamesPlayed;
        player.wins = data.wins;
        player.losses = data.losses;
        this.players[data.name] = player;
      });
    } catch (error) {
      console.error('Error loading players:', error);
    }
  }

  async loadGameHistory() {
    try {
      const response = await fetch('/data/game_history.json');
      const historyData = await response.json();
      this.gameHistory = historyData.map(data => {
        const winner = this.players[data.winner];
        const loser = this.players[data.loser];
        const gameResult = new GameResult(winner, loser, data.winnerScore, data.loserScore);
        gameResult.winnerScoreChange = data.winnerScoreChange;
        gameResult.loserScoreChange = data.loserScoreChange;
        return gameResult;
      });
    } catch (error) {
      console.error('Error loading game history:', error);
    }
  }

  async saveData() {
    await this.savePlayers();
    await this.saveGameHistory();
  }

  async savePlayers() {
    const playerData = Object.values(this.players).map(player => ({
      name: player.name,
      score: player.score,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      password: player.password
    }));
    
    // In a real application, you would send this data to a server
    console.log('Saving players:', playerData);
  }

  async saveGameHistory() {
    const historyData = this.gameHistory.map(game => ({
      winner: game.winner.name,
      loser: game.loser.name,
      winnerScore: game.winnerScore,
      loserScore: game.loserScore,
      winnerScoreChange: game.winnerScoreChange,
      loserScoreChange: game.loserScoreChange,
      isSkunk: game.isSkunk
    }));
    
    // In a real application, you would send this data to a server
    console.log('Saving game history:', historyData);
  }

  addPlayer(name, password) {
    if (!(name in this.players)) {
      this.players[name] = new Player(name, 1000, password);
      this.saveData();
      return true;
    }
    return false;
  }

  recordGame(player1Name, player2Name, player1Score, player2Score) {
    const player1 = this.players[player1Name];
    const player2 = this.players[player2Name];
    const gameResult = new GameResult(player1, player2, player1Score, player2Score);
    
    // Update player stats
    gameResult.winner.updateScore(gameResult.loser, true, Math.abs(player1Score - player2Score));
    gameResult.loser.updateScore(gameResult.winner, false, Math.abs(player1Score - player2Score));

    // Add to game history
    this.gameHistory.unshift(gameResult);

    // Limit game history if needed
    if (this.gameHistory.length > 30) {
      this.gameHistory.pop();
    }

    this.saveData();
  }

  getLeaderboard() {
    return Object.values(this.players)
      .sort((a, b) => b.score - a.score)
      .map(player => ({
        name: player.name,
        score: player.score.toFixed(2),
        ratio: player.winLossRatio()
      }));
  }

  getGameHistory() {
    return this.gameHistory;
  }
}

export default new DataService();
