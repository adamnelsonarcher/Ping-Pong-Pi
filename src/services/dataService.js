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
    // Initialize with default settings
    this.settings = {
      SCORE_CHANGE_K_FACTOR: 70,
      POINT_DIFFERENCE_WEIGHT: 6,
      ACTIVITY_THRESHOLD: 3,
      DEFAULT_RANK: "Unranked",
      PLAYER1_SCOREBOARD_COLOR: "#4CAF50",
      PLAYER2_SCOREBOARD_COLOR: "#2196F3",
      GAME_HISTORY_KEEP: 30,
      ADDPLAYER_ADMINONLY: false,
      ADMIN_PASSWORD: ""
    };
    this.currentUser = null;
    this.players = {};
    this.gameHistory = [];
    this.isLocalMode = localStorage.getItem('isLocalMode') === 'true';
  }

  setLocalMode(isLocal) {
    this.isLocalMode = isLocal;
  }

  async loadData() {
    if (this.isLocalMode) {
      const localData = JSON.parse(localStorage.getItem('localGameData'));
      if (localData) {
        // Merge with default settings to ensure all properties exist
        this.settings = { ...this.settings, ...localData.settings };
        this.players = localData.players;
        this.gameHistory = localData.gameHistory;
        return true;
      }
      // If no local data, keep default settings
      return true;
    } else {
      return this.loadServerData();
    }
  }

  async saveData() {
    if (this.isLocalMode) {
      const dataToSave = {
        settings: this.settings,
        players: this.players,
        gameHistory: this.gameHistory
      };
      localStorage.setItem('localGameData', JSON.stringify(dataToSave));
      return true;
    } else {
      return this.saveServerData();
    }
  }

  async setCurrentUser(username) {
    this.currentUser = username;
    localStorage.setItem('currentUser', username);
    return this.loadData();
  }

  async createUser(username, authType) {
    try {
      if (!username) {
        console.error('No username provided');
        return { success: false, isNewAccount: false };
      }

      if (this.isLocalMode) {
        return { 
          success: await this.setCurrentUser(username), 
          isNewAccount: true 
        };
      }

      // First, get current data
      const response = await fetch('http://localhost:3001/api/getData');
      const data = await response.json();
      
      const isNewAccount = !data.users[username];
      
      if (isNewAccount) {
        // Create new user with empty admin password
        data.users[username] = {
          settings: {
            ...this.settings,
            ADMIN_PASSWORD: "" // Ensure new accounts start with empty password
          },
          players: {},
          gameHistory: []
        };

        // Save the new user data and wait for completion
        const saveResponse = await fetch('http://localhost:3001/api/saveData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save new user data');
        }

        // Wait for data to be saved and available
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Set current user
      this.currentUser = username;
      localStorage.setItem('currentUser', username);
      
      // Verify data is loaded correctly
      let retries = 3;
      while (retries > 0) {
        try {
          await this.loadData();
          if (this.settings && this.settings.ADMIN_PASSWORD !== undefined) {
            break;
          }
        } catch (error) {
          console.log('Retrying data load...');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }

      return { success: true, isNewAccount };
    } catch (error) {
      console.error('Error in createUser:', error);
      return { success: false, isNewAccount: false };
    }
  }

  getLeaderboard() {
    const activePlayers = Object.values(this.players)
      .filter(player => player.active)
      .sort((a, b) => b.score - a.score)
      .map(player => ({
        name: player.name,
        score: player.score.toFixed(2),
        ratio: player.winLossRatio,
        active: true
      }));

    const inactivePlayers = Object.values(this.players)
      .filter(player => !player.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => ({
        name: player.name,
        score: this.settings.DEFAULT_RANK,
        ratio: player.winLossRatio,
        active: false
      }));

    return [...activePlayers, ...inactivePlayers];
  }

  async loadServerData() {
    const response = await fetch('http://localhost:3001/api/getData');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (data.users[this.currentUser]) {
      const userData = data.users[this.currentUser];
      this.settings = userData.settings;
      this.players = userData.players;
      this.gameHistory = userData.gameHistory;
      return true;
    }
    return false;
  }

  async saveServerData() {
    const response = await fetch('http://localhost:3001/api/getData');
    const data = await response.json();
    
    data.users[this.currentUser] = {
      settings: this.settings,
      players: this.players,
      gameHistory: this.gameHistory
    };

    const saveResponse = await fetch('http://localhost:3001/api/saveData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    return saveResponse.ok;
  }

  async updateSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      
      if (this.isLocalMode) {
        const localData = JSON.parse(localStorage.getItem('localGameData'));
        localData.settings = this.settings;
        localStorage.setItem('localGameData', JSON.stringify(localData));
        return true;
      } else {
        return this.saveServerData();
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  async setAdminPassword(password) {
    try {
      return await this.updateSettings({
        ...this.settings,
        ADMIN_PASSWORD: password
      });
    } catch (error) {
      console.error('Error setting admin password:', error);
      return false;
    }
  }

  async saveGameHistory(gameResult) {
    this.gameHistory.push(gameResult);
    return this.saveData();
  }

  getGameHistory() {
    return this.gameHistory || [];
  }

  // ... rest of your existing methods ...
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
    const score1 = parseInt(player1Score, 10);
    const score2 = parseInt(player2Score, 10);
    
    if (isNaN(score1) || isNaN(score2)) {
      console.error('Invalid scores:', player1Score, player2Score);
      return null;
    }

    const gameResult = dataService.recordGame(player1Name, player2Name, score1, score2);
    if (gameResult) {
      await dataService.saveGameHistory(gameResult);
      return gameResult;
    }
    return null;
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

