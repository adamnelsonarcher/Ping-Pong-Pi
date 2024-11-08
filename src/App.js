import React, { useState, useEffect } from 'react';
import './App.css';
import Leaderboard from './components/Leaderboard';
import GameHistory from './components/GameHistory';
import Scoreboard from './components/Scoreboard';
import PlayerSelection from './components/PlayerSelection';
import AdminControls from './components/AdminControls';
import InputModal from './components/InputModal';
import dataService, { getPlayers, endGame, quitGame, getSettings } from './services/dataService';
import { useSettings } from './contexts/SettingsContext';
import UserAccount from './components/UserAccount';
import LoginScreen from './components/LoginScreen';
import AdminPasswordPrompt from './components/AdminPasswordPrompt';

function App() {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentUser'));
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedPlayers, setSelectedPlayers] = useState({ player1: null, player2: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [gameInProgress, setGameInProgress] = useState(false);
  const [gameHistoryKeep, setGameHistoryKeep] = useState(10); // default value
  const { settings } = useSettings();
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      if (currentUser) {
        try {
          await dataService.setCurrentUser(currentUser);
          await dataService.loadData();
          const players = Object.values(dataService.players);
          setPlayers(players);
          setLeaderboard(dataService.getLeaderboard());
          setGameHistory(dataService.gameHistory);
          setGameHistoryKeep(dataService.settings.GAME_HISTORY_KEEP);
          setCurrentScreen('main');
        } catch (error) {
          console.error('Error initializing app:', error);
          if (!error.message.includes('User not found')) {
            handleLogout();
          }
        }
      } else {
        setCurrentScreen('login');
      }
    };
    
    initializeApp();
  }, [currentUser]);

  useEffect(() => {
    const loadSettings = async () => {
      await dataService.loadData();
      setGameHistoryKeep(dataService.settings.GAME_HISTORY_KEEP);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await dataService.loadData();
      updateLeaderboard();
      updateGameHistory();
      const playerList = Object.values(dataService.players);
      setPlayers(playerList);
      
      // Load saved player selections from localStorage
      const savedPlayer1 = localStorage.getItem('selectedPlayer1');
      const savedPlayer2 = localStorage.getItem('selectedPlayer2');
      if (savedPlayer1 && savedPlayer2) {
        setSelectedPlayers({
          player1: savedPlayer1,
          player2: savedPlayer2
        });
      }
    };
    loadData();
  }, []);

  const updateLeaderboard = () => {
    const leaderboardData = dataService.getLeaderboard();
    setLeaderboard(leaderboardData);
  };

  const updateGameHistory = () => {
    const fullHistory = dataService.getGameHistory();
    setGameHistory(fullHistory.slice(-gameHistoryKeep)); // Ensure slicing is applied here
  };

  const handleGameEnd = async (gameResult) => {
    console.log('handleGameEnd called with result:', gameResult);
    
    try {
      const result = await endGame(gameResult.player1, gameResult.player2, gameResult.score1, gameResult.score2);
      if (result) {
        // Update both leaderboard and game history at once
        setLeaderboard(dataService.getLeaderboard());
        setGameHistory(prev => [...prev, result].slice(-gameHistoryKeep));
      }
    } catch (error) {
      console.error('Error saving game data:', error);
    } finally {
      setCurrentScreen('main');
      setGameInProgress(false);
      localStorage.setItem('selectedPlayer1', selectedPlayers.player1);
      localStorage.setItem('selectedPlayer2', selectedPlayers.player2);
    }
  };

  const handleQuitGame = async () => {
    try {
      await quitGame(selectedPlayers.player1, selectedPlayers.player2);
      updateGameHistory();
    } catch (error) {
      console.error('Error in handleQuitGame:', error);
    } finally {
      setCurrentScreen('main');
      setGameInProgress(false);
    }
  };

  const handleAddPlayer = () => {
    setModalConfig({
      title: 'Add New Player',
      fields: [
        { name: 'playerName', label: 'Player Name' },
        { name: 'password', label: 'Password', type: 'password' }
      ],
      onSubmit: (values) => {
        dataService.addPlayer(values.playerName, values.password);
        updateLeaderboard();
        setIsModalOpen(false);
      }
    });
    setIsModalOpen(true);
  };

  const handleClearSelections = () => {
    console.log('Clearing player selections');
    setSelectedPlayers({ player1: '', player2: '' });
    localStorage.removeItem('selectedPlayer1');
    localStorage.removeItem('selectedPlayer2');
  };

  const handleStartGame = () => {
    if (selectedPlayers.player1 && selectedPlayers.player2) {
      setCurrentScreen('game');
      setGameInProgress(true);
    } else {
      alert("Please select two players before starting a game.");
    }
  };

  const handlePlayerSelect = (playerName, index) => {
    if (playerName === '') {
      const newSelectedPlayers = { ...selectedPlayers };
      newSelectedPlayers[`player${index + 1}`] = '';
      setSelectedPlayers(newSelectedPlayers);
      localStorage.setItem(`selectedPlayer${index + 1}`, '');
    } else {
      setModalConfig({
        title: `Enter Password for ${playerName}`,
        fields: [
          { name: 'password', label: '', type: 'password' }
        ],
        onSubmit: (values) => {
          if (values.password === dataService.players[playerName].password) {
            const newSelectedPlayers = { ...selectedPlayers };
            newSelectedPlayers[`player${index + 1}`] = playerName;
            setSelectedPlayers(newSelectedPlayers);
            localStorage.setItem(`selectedPlayer${index + 1}`, playerName);
            setIsModalOpen(false);
          } else {
            alert('Incorrect password');
          }
        },
        onCancel: () => {
          const newSelectedPlayers = { ...selectedPlayers };
          newSelectedPlayers[`player${index + 1}`] = '';
          setSelectedPlayers(newSelectedPlayers);
          localStorage.setItem(`selectedPlayer${index + 1}`, '');
          setIsModalOpen(false);
        }
      });
      setIsModalOpen(true);
    }
  };

  const handleAdminAccess = (values) => {
    if (dataService.settings && values.password === dataService.settings.ADMIN_PASSWORD) {
      setCurrentScreen('admin');
      setIsModalOpen(false);
    } else {
      alert('Incorrect admin password');
      setIsModalOpen(false);
    }
  };

  const handleAdminClick = () => {
    setModalConfig({
      title: 'Enter Admin Password',
      fields: [
        { name: 'password', label: 'Password', type: 'password' }
      ],
      onSubmit: handleAdminAccess
    });
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    // Clear all local state
    setSelectedPlayers({ player1: null, player2: null });
    setLeaderboard([]);
    setGameHistory([]);
    setPlayers([]);
    setGameHistoryKeep(10);
    
    // Clear localStorage
    localStorage.removeItem('selectedPlayer1');
    localStorage.removeItem('selectedPlayer2');
    localStorage.removeItem('currentUser');
    
    // Reset dataService to default state
    dataService.currentUser = null;
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  const handleLogin = async (username) => {
    const result = await dataService.createUser(username);
    if (result.success) {
      if (result.isFirstUser) {
        setShowAdminPasswordPrompt(true);
      } else {
        setCurrentUser(username);
        setCurrentScreen('main');
      }
    }
  };

  const handleSetAdminPassword = async (password) => {
    await dataService.setAdminPassword(password);
    setShowAdminPasswordPrompt(false);
    setCurrentUser(dataService.currentUser);
    setCurrentScreen('main');
  };

  return (
    <div className="App">
      {currentScreen === 'login' ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <>
          <UserAccount currentUser={currentUser} onLogout={handleLogout} />
          {currentScreen === 'main' && (
            <>
              <main className="App-main">
                <div className="App-column leaderboard-column">
                  <Leaderboard players={leaderboard} />
                </div>
                <div className="App-column history-column">
                  <GameHistory gameHistory={gameHistory} />
                </div>
              </main>
              <footer className="App-footer">
                <div className="player-controls">
                  <PlayerSelection 
                    players={players}
                    selectedPlayers={selectedPlayers}
                    onPlayerSelect={handlePlayerSelect}
                  />
                  <button className="btn clear-selections" onClick={handleClearSelections}>
                    Clear Selections
                  </button>
                  <button className="btn start-game" onClick={handleStartGame}>
                    Start Game
                  </button>
                </div>
                <div className="admin-buttons">
                  {settings && !settings.ADDPLAYER_ADMINONLY && (
                    <button className="btn add-player" onClick={handleAddPlayer}>
                      Add Player
                    </button>
                  )}
                  <button className="btn admin-controls" onClick={handleAdminClick}>
                    Admin
                  </button>
                </div>
              </footer>
            </>
          )}
          {currentScreen === 'game' && (
            <Scoreboard 
              player1={selectedPlayers.player1} 
              player2={selectedPlayers.player2}
              onGameEnd={handleGameEnd}
              onQuit={handleQuitGame}
            />
          )}
          {currentScreen === 'admin' && (
            <AdminControls 
              onExit={() => setCurrentScreen('main')} 
              onAddPlayer={handleAddPlayer}
            />
          )}
          <InputModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            {...modalConfig}
          />
          {showAdminPasswordPrompt && (
            <AdminPasswordPrompt onSubmit={handleSetAdminPassword} />
          )}
        </>
      )}
    </div>
  );
}

export default App;
