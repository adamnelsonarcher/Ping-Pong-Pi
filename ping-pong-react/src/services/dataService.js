import settings from '../settings';

class Player {
  constructor(name, score = 1000, password = "") {
    this.name = name;
    this.score = score;
    this.gamesPlayed = 0;
    this.wins = 0;
    this.losses = 0;
    this.password = password;
    this.currentStreak = 0;
    this.maxWinStreak = 0;
    this.lifetimeGamesPlayed = 0;
    this.lifetimeWins = 0;
    this.lifetimeLosses = 0;
    this.lifetimeScore = score;
    this.active = false;
    this.scoreHistory = [score];
  }

  calculateScoreChange(currentScore, opponentScore, result, K) {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentScore - currentScore) / 450));
    let scoreChange = K * (result - expectedScore);
    if ((expectedScore < 0.45 && result === 1) || (expectedScore > 0.65 && result === 0)) {
      scoreChange *= 1.3;
    }
    return scoreChange;
  }

  updateScore(opponent, won, pointDifference) {
    const opponentIsUnranked = !opponent.active;
    const playerIsUnranked = !this.active;

    let K = settings.SCORE_CHANGE_K_FACTOR + pointDifference * settings.POINT_DIFFERENCE_WEIGHT;

    if (playerIsUnranked && opponentIsUnranked) {
      K *= 1.2;
    } else if (playerIsUnranked) {
      K *= 1.2;
    } else if (opponentIsUnranked) {
      K = 20;
    }

    const result = won ? 1 : 0;
    const scoreChange = this.calculateScoreChange(this.score, opponent.score, result, K);
    this.score += scoreChange;
    this.gamesPlayed += 1;

    const lifetimeScoreChange = this.calculateScoreChange(this.lifetimeScore, opponent.lifetimeScore, result, K);
    this.lifetimeScore += lifetimeScoreChange;

    if (this.lifetimeScore < 100) {
      this.lifetimeScore = 100;
    }

    this.scoreHistory.push(Math.round(this.lifetimeScore * 100) / 100);
    this.updateActiveStatus();

    if (won) {
      this.wins += 1;
      this.currentStreak += 1;
      if (this.currentStreak > this.maxWinStreak) {
        this.maxWinStreak = this.currentStreak;
      }
      if (this.active) {
        this.lifetimeWins += 1;
      }
    } else {
      this.losses += 1;
      this.currentStreak = 0;
      if (this.active) {
        this.lifetimeLosses += 1;
      }
    }

    return scoreChange;
  }

  winLossRatio() {
    return this.gamesPlayed === 0 ? "0/0" : `${this.wins}/${this.losses}`;
  }

  updateActiveStatus() {
    this.active = this.gamesPlayed >= settings.ACTIVITY_THRESHOLD;
  }
}

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
        player.lifetimeGamesPlayed = data.lifetimeGamesPlayed;
        player.lifetimeWins = data.lifetimeWins;
        player.lifetimeLosses = data.lifetimeLosses;
        player.lifetimeScore = data.lifetimeScore;
        player.currentStreak = data.currentStreak;
        player.maxWinStreak = data.maxWinStreak;
        player.scoreHistory = data.scoreHistory;
        player.updateActiveStatus();
        this.players[data.name] = player;
      });
    } catch (error) {
      console.error('Error loading players:', error);
    }
  }

  async loadGameHistory() {
    try {
      const response = await fetch('/data/game_history.json');
      this.gameHistory = await response.json();
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
      password: player.password,
      lifetimeGamesPlayed: player.lifetimeGamesPlayed,
      lifetimeWins: player.lifetimeWins,
      lifetimeLosses: player.lifetimeLosses,
      lifetimeScore: player.lifetimeScore,
      currentStreak: player.currentStreak,
      maxWinStreak: player.maxWinStreak,
      scoreHistory: player.scoreHistory
    }));
    
    // In a real application, you would send this data to a server
    console.log('Saving players:', playerData);
    // For now, we'll just update localStorage
    localStorage.setItem('players', JSON.stringify(playerData));
  }

  async saveGameHistory() {
    // In a real application, you would send this data to a server
    console.log('Saving game history:', this.gameHistory);
    // For now, we'll just update localStorage
    localStorage.setItem('gameHistory', JSON.stringify(this.gameHistory));
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
    const winner = player1Score > player2Score ? player1 : player2;
    const loser = player1Score > player2Score ? player2 : player1;
    const winnerScore = Math.max(player1Score, player2Score);
    const loserScore = Math.min(player1Score, player2Score);

    // Calculate score changes
    const pointDifference = Math.abs(player1Score - player2Score);
    const winnerScoreChange = winner.updateScore(loser, true, pointDifference);
    const loserScoreChange = loser.updateScore(winner, false, pointDifference);

    // Update player stats
    winner.gamesPlayed++;
    winner.wins++;
    winner.lifetimeGamesPlayed++;
    winner.lifetimeWins++;
    
    loser.gamesPlayed++;
    loser.losses++;
    loser.lifetimeGamesPlayed++;
    loser.lifetimeLosses++;

    // Create game history entry
    const gameResult = {
      winner: winner.name,
      loser: loser.name,
      winnerScore,
      loserScore,
      winnerScoreChange,
      loserScoreChange,
      isSkunk: (winnerScore === 7 && loserScore === 0) || (winnerScore === 11 && loserScore === 1),
      date: new Date().toISOString()
    };

    // Add to game history
    this.gameHistory.unshift(gameResult);

    // Limit game history
    if (this.gameHistory.length > settings.GAME_HISTORY_KEEP) {
      this.gameHistory.pop();
    }

    // Save updated data
    this.saveData();

    return gameResult;
  }

  getLeaderboard() {
    return Object.values(this.players)
      .sort((a, b) => b.score - a.score)
      .map(player => ({
        name: player.name,
        score: player.score.toFixed(2),
        ratio: player.winLossRatio(),
        active: player.active
      }));
  }

  getGameHistory() {
    return this.gameHistory;
  }
}

export default new DataService();
