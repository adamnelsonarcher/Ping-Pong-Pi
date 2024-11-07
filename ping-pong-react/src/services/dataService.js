import settings from '../settings1';

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

  updateScore(opponent, won, pointDifference, gameSettings) {
    const opponentIsUnranked = !opponent.active;
    const playerIsUnranked = !this.active;

    let K = gameSettings.SCORE_CHANGE_K_FACTOR + pointDifference * gameSettings.POINT_DIFFERENCE_WEIGHT;

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
    this.lifetimeGamesPlayed += 1; // Increment lifetime games played

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
      this.lifetimeWins += 1;
      this.currentStreak += 1;
      if (this.currentStreak > this.maxWinStreak) {
        this.maxWinStreak = this.currentStreak;
      }
    } else {
      this.losses += 1;
      this.lifetimeLosses += 1;
      this.currentStreak = 0;
    }

    return scoreChange;
  }

  winLossRatio() {
    return this.gamesPlayed === 0 ? "0/0" : `${this.wins}/${this.losses}`;
  }

  updateActiveStatus(activityThreshold = 3) {
    this.active = this.gamesPlayed >= activityThreshold;
  }
}

class DataService {
  constructor() {
    this.players = {};
    this.gameHistory = [];
    this.settings = {};
    this.currentUser = 'admin'; // Default user
  }

  async loadData() {
    try {
      const response = await fetch('http://localhost:3001/api/getData');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const userData = data.users[this.currentUser];

      this.settings = userData.settings;
      
      // Convert player objects back to Player instances
      this.players = {};
      Object.entries(userData.players).forEach(([name, data]) => {
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
        player.updateActiveStatus(this.settings.ACTIVITY_THRESHOLD);
        this.players[name] = player;
      });

      this.gameHistory = userData.gameHistory;
      
      console.log('All data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      this.settings = {};
      this.players = {};
      this.gameHistory = [];
    }
  }

  async saveData() {
    try {
      const response = await fetch('http://localhost:3001/api/saveData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUser: this.currentUser,
          settings: this.settings,
          players: this.players,
          gameHistory: this.gameHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save data');
      }
      console.log('All data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
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
    // Validate scores
    if (typeof player1Score !== 'number' || typeof player2Score !== 'number') {
      console.error('Invalid scores:', player1Score, player2Score);
      return null;
    }

    const player1 = this.players[player1Name];
    const player2 = this.players[player2Name];
    
    if (!player1 || !player2) {
      console.error('Players not found:', player1Name, player2Name);
      return null;
    }

    const winner = player1Score > player2Score ? player1 : player2;
    const loser = player1Score > player2Score ? player2 : player1;

    // Calculate score changes
    const pointDifference = Math.abs(player1Score - player2Score);
    const winnerScoreChange = winner.updateScore(loser, true, pointDifference, this.settings);
    const loserScoreChange = loser.updateScore(winner, false, pointDifference, this.settings);

    // Create game history entry
    const gameResult = {
      player1: player1Name,
      player2: player2Name,
      score: `${player1Score} - ${player2Score}`,
      player1Rank: this.getPlayerRank(player1Name),
      player2Rank: this.getPlayerRank(player2Name),
      pointChange1: player1 === winner ? winnerScoreChange : loserScoreChange,
      pointChange2: player2 === winner ? winnerScoreChange : loserScoreChange,
      date: new Date().toISOString()
    };

    return gameResult;
  }

  getPlayerRank(playerName) {
    const activePlayers = Object.values(this.players).filter(p => p.active);
    const sortedPlayers = activePlayers.sort((a, b) => b.score - a.score);
    const playerIndex = sortedPlayers.findIndex(p => p.name === playerName);
    return playerIndex !== -1 ? playerIndex + 1 : 'Unranked';
  }

  getLeaderboard() {
    const activePlayers = Object.values(this.players)
      .filter(player => player.active)
      .sort((a, b) => b.score - a.score)
      .map(player => ({
        name: player.name,
        score: player.score.toFixed(2),
        ratio: player.winLossRatio(),
        active: true
      }));

    const inactivePlayers = Object.values(this.players)
      .filter(player => !player.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => ({
        name: player.name,
        score: this.settings.DEFAULT_RANK,
        ratio: player.winLossRatio(),
        active: false
      }));

    return [...activePlayers, ...inactivePlayers];
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
    if (this.players[playerName]) {
      this.players[playerName].password = newPassword;
      await this.saveData();
      return true;
    }
    return false;
  }

  async editPlayerScore(playerName, newScore) {
    if (this.players[playerName]) {
      this.players[playerName].score = newScore;
      this.players[playerName].scoreHistory.push(newScore);
      await this.saveData();
      return true;
    }
    return false;
  }

  async deletePlayer(playerName) {
    if (this.players[playerName]) {
      delete this.players[playerName];
      await this.saveData();
      return true;
    }
    return false;
  }

  async resetAllScores() {
    Object.values(this.players).forEach(player => {
      player.score = 1000;
      player.scoreHistory = [1000];
      player.gamesPlayed = 0;
      player.wins = 0;
      player.losses = 0;
      player.currentStreak = 0;
      player.active = false;
    });
    await this.saveData();
    return true;
  }

  async saveSettings() {
    try {
      const response = await fetch('/api/saveSettings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.settings),
      });
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  getSettings() {
    return this.settings;
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveData();
    return true;
  }

  async saveGameHistory(gameResult) {
    try {
      this.gameHistory.push(gameResult);
      await this.saveData();
      return true;
    } catch (error) {
      console.error('Error saving game history:', error);
      throw error;
    }
  }
}

const dataService = new DataService();

export default dataService;

export const getPlayers = async () => {
  await dataService.loadData();
  return Object.values(dataService.players);
};

export const getSettings = async () => {
  await dataService.loadData();
  return dataService.settings;
};

export const editPlayerPassword = async (playerName, newPassword) => {
  return await dataService.editPlayerPassword(playerName, newPassword);
};

export const editPlayerScore = async (playerName, newScore) => {
  return await dataService.editPlayerScore(playerName, newScore);
};

export const deletePlayer = async (playerName) => {
  return await dataService.deletePlayer(playerName);
};

export const resetAllScores = async () => {
  return await dataService.resetAllScores();
};

export const updateSettings = async (newSettings) => {
  return await dataService.updateSettings(newSettings);
};

export const getGameHistory = () => {
  return dataService.gameHistory;
};

export const endGame = async (player1Name, player2Name, player1Score, player2Score) => {
  try {
    // Convert scores to numbers and validate
    const score1 = parseInt(player1Score, 10);
    const score2 = parseInt(player2Score, 10);
    
    if (isNaN(score1) || isNaN(score2)) {
      console.error('Invalid scores:', player1Score, player2Score);
      return null;
    }

    const gameResult = dataService.recordGame(player1Name, player2Name, score1, score2);
    if (gameResult) {
      await dataService.saveGameHistory(gameResult);
    }
    return gameResult;
  } catch (error) {
    console.error('Error ending game:', error);
    return null;
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
    await dataService.saveGameHistory(gameResult);
    return gameResult;
  } catch (error) {
    console.error('Error quitting game:', error);
    return null;
  }
};

