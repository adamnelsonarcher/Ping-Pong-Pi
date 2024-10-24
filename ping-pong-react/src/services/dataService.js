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
    this.scoreHistory = [score]; // Ensure this is always initialized
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

    // Add a check before pushing to scoreHistory
    if (!Array.isArray(this.scoreHistory)) {
      this.scoreHistory = [];
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
      const response = await fetch('/api/getPlayers');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const playerData = await response.json();
      this.players = {};
      playerData.forEach(data => {
        const player = new Player(data.name, data.score, data.password);
        player.gamesPlayed = data.gamesPlayed || 0;
        player.wins = data.wins || 0;
        player.losses = data.losses || 0;
        player.lifetimeGamesPlayed = data.lifetimeGamesPlayed || 0;
        player.lifetimeWins = data.lifetimeWins || 0;
        player.lifetimeLosses = data.lifetimeLosses || 0;
        player.lifetimeScore = data.lifetimeScore || data.score;
        player.currentStreak = data.currentStreak || 0;
        player.maxWinStreak = data.maxWinStreak || 0;
        player.scoreHistory = Array.isArray(data.scoreHistory) ? data.scoreHistory : [data.score];
        player.updateActiveStatus();
        this.players[data.name] = player;
      });
      // Removed console.log for full player data
    } catch (error) {
      console.error('Error loading players:', error);
    }
  }

  async loadGameHistory() {
    try {
      const response = await fetch('/api/getGameHistory');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.gameHistory = data;
    } catch (error) {
      console.error('Error loading game history:', error);
      this.gameHistory = [];
    }
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
    
    try {
      console.log('Sending player data to server:', playerData);
      const response = await fetch('/api/savePlayers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playerData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save players data: ${errorData.error}, ${errorData.details}`);
      }
      console.log('Players data saved successfully');
    } catch (error) {
      console.error('Error saving players data:', error);
      throw error;
    }
  }

  async saveGameHistory() {
    try {
      const response = await fetch('/api/saveGameHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.gameHistory),
      });
      if (!response.ok) {
        throw new Error('Failed to save game history');
      }
    } catch (error) {
      console.error('Error saving game history:', error);
      throw error;
    }
  }

  async saveData() {
    await this.savePlayers();
    await this.saveGameHistory();
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

    // Create game history entry
    const gameResult = {
      player1: player1Name,
      player2: player2Name,
      score: `${winnerScore}-${loserScore}`,
      pointChange1: player1 === winner ? winnerScoreChange : loserScoreChange,
      pointChange2: player2 === winner ? winnerScoreChange : loserScoreChange,
      date: new Date().toISOString()
    };

    // Add to game history
    this.gameHistory.push(gameResult);

    // Limit game history to last 40 games
    if (this.gameHistory.length > 40) {
      this.gameHistory = this.gameHistory.slice(-40);
    }

    // Save updated data
    this.saveData();

    return gameResult;
  }

  getGameHistoryMessage(gameResult) {
    let message = '';
    if (gameResult.winnerRank === settings.DEFAULT_RANK || gameResult.loserRank === settings.DEFAULT_RANK) {
      const winnerRankText = gameResult.winnerRank === settings.DEFAULT_RANK ? `(${settings.DEFAULT_RANK})` : '';
      const loserRankText = gameResult.loserRank === settings.DEFAULT_RANK ? `(${settings.DEFAULT_RANK})` : '';
      message = `<b>${gameResult.winner}</b>${winnerRankText} beat <b>${gameResult.loser}</b>${loserRankText} <b>[${gameResult.winnerScore}-${gameResult.loserScore}]</b>`;
    } else {
      const winnerChangeText = gameResult.winnerScoreChange > 0 ? `+${gameResult.winnerScoreChange.toFixed(2)}` : gameResult.winnerScoreChange.toFixed(2);
      const loserChangeText = gameResult.loserScoreChange > 0 ? `+${gameResult.loserScoreChange.toFixed(2)}` : gameResult.loserScoreChange.toFixed(2);
      
      if (gameResult.isUnderdogVictory) {
        message = `<b>${gameResult.winner}</b> (ranked #${gameResult.winnerRank}) pulled off an <span style='color:gold;'><b>UNDERDOG VICTORY</b></span> against <b>${gameResult.loser}</b> (ranked #${gameResult.loserRank}) [<b>${gameResult.winnerScore} - ${gameResult.loserScore}</b>] : ${winnerChangeText} / ${loserChangeText}`;
      } else if (gameResult.isSkunk) {
        message = `<span style='color:red;'><b>${gameResult.winner}</b> SKUNKED <b>${gameResult.loser}</b> <b>[${gameResult.winnerScore}-${gameResult.loserScore}]</span></b>: ${winnerChangeText} / ${loserChangeText}`;
      } else {
        message = `<b>${gameResult.winner}</b> beat <b>${gameResult.loser}</b> <b>[${gameResult.winnerScore}-${gameResult.loserScore}]</b>: ${winnerChangeText} / ${loserChangeText}`;
      }
    }
    return message;
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

  async testServerConnection() {
    try {
      const response = await fetch('/api/test');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      console.log('Raw test response:', text);
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        throw new Error('Invalid JSON response from server');
      }
      console.log('Server test response:', data);
      return true;
    } catch (error) {
      console.error('Error testing server connection:', error);
      return false;
    }
  }

  async editPlayerPassword(playerName, newPassword) {
    this.players[playerName].password = newPassword;
    await this.savePlayers();
  }

  async editPlayerScore(playerName, newScore) {
    this.players[playerName].score = newScore;
    await this.savePlayers();
  }

  async deletePlayer(playerName) {
    delete this.players[playerName];
    await this.savePlayers();
  }

  async resetAllScores() {
    Object.values(this.players).forEach(player => {
      player.score = 1000;
      player.gamesPlayed = 0;
      player.wins = 0;
      player.losses = 0;
      player.currentStreak = 0;
    });
    await this.savePlayers();
  }

  async updateSettings(newSettings) {
    // In a real application, you would send this to the server
    // For now, we'll just update the local settings
    Object.assign(settings, newSettings);
    console.log('Settings updated:', settings);
  }
}

const dataService = new DataService();

export default dataService;

export const getPlayers = async () => {
  await dataService.loadPlayers();
  return Object.values(dataService.players);
};

export const addPlayer = async (newPlayer) => {
  try {
    const added = dataService.addPlayer(newPlayer.name, newPlayer.password);
    if (added) {
      await dataService.saveData();
      console.log('Player added and saved:', newPlayer.name);
      // Immediately load players to verify the save
      await dataService.loadPlayers();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error adding player:', error);
    return false;
  }
};

export const savePlayersData = async () => {
  try {
    await dataService.savePlayers();
    return true;
  } catch (error) {
    console.error('Error saving players data:', error);
    return false;
  }
};

export const endGame = async (player1Name, player2Name, player1Score, player2Score) => {
  try {
    const gameResult = dataService.recordGame(player1Name, player2Name, player1Score, player2Score);
    const historyMessage = dataService.getGameHistoryMessage(gameResult);
    await dataService.saveData();
    return { gameResult, historyMessage };
  } catch (error) {
    console.error('Error ending game:', error);
    return null;
  }
};

export const saveGameHistory = async (gameResult) => {
  try {
    dataService.gameHistory.unshift(gameResult);
    await dataService.saveGameHistory();
    return true;
  } catch (error) {
    console.error('Error saving game history:', error);
    return false;
  }
};

export const quitGame = async (player1Name, player2Name) => {
  try {
    const gameResult = {
      player1: player1Name,
      player2: player2Name,
      score: 'Quit',
      pointChange1: 0,
      pointChange2: 0,
      date: new Date().toISOString()
    };
    dataService.gameHistory.push(gameResult);
    await dataService.saveGameHistory();
    return gameResult;
  } catch (error) {
    console.error('Error quitting game:', error);
    return null;
  }
};

export const getLeaderboard = () => {
  return dataService.getLeaderboard();
};

export const getGameHistory = () => {
  return dataService.getGameHistory();
};

export const editPlayerPassword = async (playerName, newPassword) => {
  await dataService.editPlayerPassword(playerName, newPassword);
};

export const editPlayerScore = async (playerName, newScore) => {
  await dataService.editPlayerScore(playerName, newScore);
};

export const deletePlayer = async (playerName) => {
  await dataService.deletePlayer(playerName);
};

export const resetAllScores = async () => {
  await dataService.resetAllScores();
};

export const updateSettings = async (newSettings) => {
  await dataService.updateSettings(newSettings);
};
