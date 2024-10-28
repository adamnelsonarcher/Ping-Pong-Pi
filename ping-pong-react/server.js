const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const playersPath = path.join(__dirname, 'public', 'data', 'players.json');
const gameHistoryPath = path.join(__dirname, 'public', 'data', 'game_history.json');
const settingsPath = path.join(__dirname, 'public', 'data', 'gameSettings.json');

// API routes
app.post('/api/savePlayers', async (req, res) => {
  try {
    // console.log('Received player data:', req.body);
    // console.log('Saving to path:', playersPath);
    await fs.writeFile(playersPath, JSON.stringify(req.body, null, 2));
    console.log('Players data saved successfully');
    res.status(200).json({ message: 'Players data saved successfully' });
  } catch (error) {
    console.error('Error saving players data:', error);
    res.status(500).json({ error: 'Failed to save players data', details: error.message });
  }
});

app.post('/api/saveGameHistory', async (req, res) => {
  try {
    const newGameResult = req.body;
    const gameHistoryPath = path.join(__dirname, 'public', 'data', 'game_history.json');

    // Read the existing game history
    let gameHistory = [];
    try {
      const data = await fs.readFile(gameHistoryPath, 'utf8');
      gameHistory = JSON.parse(data);
    } catch (error) {
      console.error('Error reading game history:', error);
      // If file doesn't exist or is empty, we'll start with an empty array
    }

    // Append the new game result
    gameHistory.push(newGameResult);

    // Keep only the last 40 games (or however many you want to keep)
    gameHistory = gameHistory.slice(-40);

    // Write the updated game history back to the file
    await fs.writeFile(gameHistoryPath, JSON.stringify(gameHistory, null, 2));

    res.status(200).json({ message: 'Game result saved successfully' });
  } catch (error) {
    console.error('Error saving game result:', error);
    res.status(500).json({ error: 'Failed to save game result' });
  }
});

app.get('/api/getPlayers', async (req, res) => {
  try {
    // console.log('Attempting to read players file from:', playersPath);
    const data = await fs.readFile(playersPath, 'utf8');
    // console.log('Raw data from players file:', data);
    const players = JSON.parse(data);
    // console.log('Parsed players data:', players);
    res.json(players);
  } catch (error) {
    console.error('Error reading players data:', error);
    if (error instanceof SyntaxError) {
      console.error('Invalid JSON in players file');
      res.status(500).json({ error: 'Invalid JSON in players file', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to read players data', details: error.message });
    }
  }
});

app.get('/api/checkPlayersFile', async (req, res) => {
  try {
    const data = await fs.readFile(playersPath, 'utf8');
    // console.log('Contents of players.json:', data);
    res.json({ fileContents: data });
  } catch (error) {
    console.error('Error reading players file:', error);
    res.status(500).json({ error: 'Failed to read players file' });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running correctly' });
});

app.get('/api/getGameHistory', async (req, res) => {
  try {
    const data = await fs.readFile(gameHistoryPath, 'utf8');
    // console.log('Raw game history data:', data);
    let gameHistory;
    try {
      gameHistory = JSON.parse(data);
    } catch (error) {
      console.error('Error parsing game history:', error);
      gameHistory = [];
    }
    res.json(gameHistory);
  } catch (error) {
    console.error('Error reading game history:', error);
    res.status(500).json({ error: 'Failed to read game history', details: error.message });
  }
});

app.get('/api/getSettings', async (req, res) => {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings', details: error.message });
  }
});

app.post('/api/saveSettings', async (req, res) => {
  try {
    await fs.writeFile(settingsPath, JSON.stringify(req.body, null, 2));
    res.status(200).json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings', details: error.message });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const cleanupGameHistory = async () => {
  const gameHistoryPath = path.join(__dirname, 'public', 'data', 'game_history.json');
  try {
    const data = await fs.readFile(gameHistoryPath, 'utf8');
    let gameHistory = JSON.parse(data);
    gameHistory = gameHistory.filter(entry => !Array.isArray(entry));
    await fs.writeFile(gameHistoryPath, JSON.stringify(gameHistory, null, 2));
    console.log('Game history cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up game history:', error);
  }
};

// Add this at the top of your server.js file
const initializeDataFiles = async () => {
  try {
    await fs.access(playersPath);
  } catch (error) {
    console.log('Creating empty players.json file');
    await fs.writeFile(playersPath, '[]');
  }

  try {
    await fs.access(gameHistoryPath);
  } catch (error) {
    console.log('Creating empty game_history.json file');
    await fs.writeFile(gameHistoryPath, '[]');
  }
};

// Call this function before starting the server
initializeDataFiles().then(() => {
  cleanupGameHistory().then(() => {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  });
});
