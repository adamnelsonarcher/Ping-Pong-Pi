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

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [selectedPlayers, setSelectedPlayers] = useState({ player1: null, player2: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [gameInProgress, setGameInProgress] = useState(false);
  const [gameHistoryKeep, setGameHistoryKeep] = useState(10); // default value
  const { settings } = useSettings();

  useEffect(() => {
    const loadSettings = async () => {
      console.log('Loading settings...');
      const settings = await getSettings();
      console.log('Settings loaded:', settings);
      setGameHistoryKeep(settings.GAME_HISTORY_KEEP);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await dataService.loadData();
      updateLeaderboard();
      updateGameHistory();
      const playerList = await getPlayers();
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
      await dataService.saveGameHistory(gameResult);
      updateLeaderboard();
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
      const quitResult = await quitGame(selectedPlayers.player1, selectedPlayers.player2);
      if (quitResult) {
        setGameHistory(prevHistory => [...prevHistory, quitResult].slice(-gameHistoryKeep));
        await dataService.saveGameHistory(quitResult);
      }
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

  return (
    <div className="App">
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
              <button className="btn clear-selections" onClick={handleClearSelections}>Clear Selections</button>
              <button className="btn start-game" onClick={handleStartGame}>Start Game</button>
            </div>
            <div className="admin-buttons">
              <button className="btn add-player" onClick={handleAddPlayer}>Add Player</button>
              <button className="btn admin-controls" onClick={() => setCurrentScreen('admin')}>Admin</button>
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
        <div className="admin-page">
          <AdminControls onExit={() => setCurrentScreen('main')} />
        </div>
      )}
      <InputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        {...modalConfig}
      />
    </div>
  );
}

export default App;
