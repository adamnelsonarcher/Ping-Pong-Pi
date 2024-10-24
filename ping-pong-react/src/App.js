import React, { useState, useEffect } from 'react';
import './App.css';
import Leaderboard from './components/Leaderboard';
import GameHistory from './components/GameHistory';
import Scoreboard from './components/Scoreboard';
import PlayerSelection from './components/PlayerSelection';
import AdminControls from './components/AdminControls';
import InputModal from './components/InputModal';
import dataService, { endGame, quitGame } from './services/dataService';

function App() {
  const [currentScreen, setCurrentScreen] = useState('main');
  const [selectedPlayers, setSelectedPlayers] = useState({ player1: null, player2: null });
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [gameInProgress, setGameInProgress] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      const isConnected = await dataService.testServerConnection();
      if (isConnected) {
        console.log('Successfully connected to the server');
      } else {
        console.error('Failed to connect to the server');
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await dataService.loadData();
      updateLeaderboard();
      updateGameHistory();
      setPlayers(Object.values(dataService.players));
    };
    loadData();
  }, []);

  const updateLeaderboard = () => {
    setLeaderboard(dataService.getLeaderboard());
  };

  const updateGameHistory = () => {
    setGameHistory(dataService.getGameHistory());
  };

  const handleGameEnd = async (player1, player2, player1Score, player2Score) => {
    const result = await endGame(player1, player2, player1Score, player2Score);
    if (result) {
      setGameHistory(prevHistory => [...prevHistory, result.gameResult].slice(-40));
      updateLeaderboard();
      setCurrentScreen('main');
      setGameInProgress(false);
    }
  };

  const handleQuitGame = async () => {
    const quitResult = await quitGame(selectedPlayers.player1, selectedPlayers.player2);
    if (quitResult) {
      setGameHistory(prevHistory => [...prevHistory, quitResult].slice(-40));
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
    setSelectedPlayers({ player1: null, player2: null });
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
      newSelectedPlayers[`player${index + 1}`] = null;
      setSelectedPlayers(newSelectedPlayers);
    } else {
      setModalConfig({
        title: `Enter Password for ${playerName}`,
        fields: [
          { name: 'password', label: 'Password', type: 'password' }
        ],
        onSubmit: (values) => {
          if (values.password === dataService.players[playerName].password) {
            const newSelectedPlayers = { ...selectedPlayers };
            newSelectedPlayers[`player${index + 1}`] = playerName;
            setSelectedPlayers(newSelectedPlayers);
            setIsModalOpen(false);
          } else {
            alert('Incorrect password');
          }
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
