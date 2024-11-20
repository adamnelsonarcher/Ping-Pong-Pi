import React, { useState, useEffect } from 'react';
import './App.css';
import Leaderboard from './components/Leaderboard';
import GameHistory from './components/GameHistory';
import Scoreboard from './components/Scoreboard';
import PlayerSelection from './components/PlayerSelection';
import AdminControls from './components/AdminControls';
import InputModal from './components/InputModal';
import dataService from './services/dataService';
import { useSettings } from './contexts/SettingsContext';
import LoginScreen from './components/LoginScreen';
import AdminPasswordPrompt from './components/AdminPasswordPrompt';
import InfoButton from './components/InfoButton';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('currentUser'));
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedPlayers, setSelectedPlayers] = useState({ player1: null, player2: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [, setGameInProgress] = useState(false);
  const [, setGameHistoryKeep] = useState(10);
  const { settings } = useSettings();
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      if (currentUser) {
        try {
          const isLocalMode = localStorage.getItem('isLocalMode') === 'true';
          if (isLocalMode) {
            dataService.setLocalMode(true);
          }
          
          await dataService.setCurrentUser(currentUser);
          await dataService.loadData();
          
          setPlayers(Object.values(dataService.players));
          setLeaderboard(dataService.getLeaderboard());
          setGameHistory(dataService.gameHistory);
          setGameHistoryKeep(dataService.settings.GAME_HISTORY_KEEP);
          
          if (!dataService.settings?.ADMIN_PASSWORD) {
            setShowAdminPasswordPrompt(true);
          } else {
            setCurrentScreen('main');
          }
        } catch (error) {
          console.error('Error initializing app:', error);
          handleLogout();
        }
      } else {
        setCurrentScreen('login');
      }
      setIsInitialized(true);
      setIsLoading(false);
    };
    
    initializeApp();
  }, [currentUser]);

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  const updateLeaderboard = () => {
    const leaderboardData = dataService.getLeaderboard();
    setLeaderboard(leaderboardData);
    setPlayers(Object.values(dataService.players));
  };

  const handleGameEnd = async (gameResult) => {
    try {
      // The game has already ended, just update the UI
      // setGameHistory(prev => [...prev, gameResult].slice(-gameHistoryKeep));
      updateLeaderboard();
    } catch (error) {
      console.error('Error handling game end:', error);
    } finally {
      setCurrentScreen('main');
      setGameInProgress(false);
    }
  };

  const handleQuitGame = async (result) => {
    try {
      setGameInProgress(false);
      setCurrentScreen('main');
      // Update game history if needed 
      //if (result) {
      //  setGameHistory(prev => [...prev, result].slice(-gameHistoryKeep));
      //}
    } catch (error) {
      console.error('Error handling quit game:', error);
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
    if (!selectedPlayers.player1 || !selectedPlayers.player2) {
      alert("Please select two players before starting a game.");
      return;
    }
    
    if (selectedPlayers.player1 === selectedPlayers.player2) {
      alert("Please select different players - the same player cannot play against themselves.");
      return;
    }

    setCurrentScreen('game');
    setGameInProgress(true);
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
    const isLocalMode = localStorage.getItem('isLocalMode') === 'true';

    // Clear current session state
    setSelectedPlayers({ player1: null, player2: null });
    setLeaderboard([]);
    setGameHistory([]);
    setPlayers([]);
    setGameHistoryKeep(10);
    
    // Clear only session-specific localStorage items
    localStorage.removeItem('currentUser');
    
    // Only clear these if we're not in local mode
    if (!isLocalMode) {
      localStorage.removeItem('localUserId');
      localStorage.removeItem('localGameData');
      localStorage.removeItem('isLocalMode');
    }
    
    // Reset dataService to default state
    dataService.currentUser = null;
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  const handleSetAdminPassword = async (password) => {
    try {
      if (dataService.isLocalMode) {
        // For local mode, update the settings directly in localStorage
        const localData = JSON.parse(localStorage.getItem('localGameData'));
        localData.settings.ADMIN_PASSWORD = password;
        localStorage.setItem('localGameData', JSON.stringify(localData));
        
        // Update dataService settings
        dataService.settings.ADMIN_PASSWORD = password;
      } else {
        // For server mode
        await dataService.updateSettings({
          ...dataService.settings,
          ADMIN_PASSWORD: password
        });
      }
      
      setShowAdminPasswordPrompt(false);
      setCurrentScreen('main');
    } catch (error) {
      console.error('Error setting admin password:', error);
      alert('Failed to set admin password. Please try again.');
    }
  };

  return (
    <div className="App">
      {!currentUser ? (
        <LoginScreen onLogin={setCurrentUser} />
      ) : !isInitialized || isLoading ? (
        <div className="loading-screen">
          <div className="loading-content">
            <h1>🏓</h1>
            <div className="loading-spinner"></div>
            <h2 className="loading-text">Loading Game Data...</h2>
          </div>
        </div>
      ) : showAdminPasswordPrompt ? (
        <AdminPasswordPrompt 
          onSubmit={handleSetAdminPassword}
          message="Please set a password for accessing the settings dashboard."
        />
      ) : (
        <>
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
                  <InfoButton currentUser={currentUser} onLogout={handleLogout} />
                </div>
              </footer>
            </>
          )}
          {currentScreen === 'game' && (
            <Scoreboard 
              player1={selectedPlayers.player1} 
              player2={selectedPlayers.player2}
              onGameEnd={handleGameEnd}
              onQuitGame={handleQuitGame}
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
        </>
      )}
    </div>
  );
}

export default App;
