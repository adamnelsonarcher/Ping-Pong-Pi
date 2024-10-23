import React, { useState, useEffect } from 'react';
import './App.css';
import Leaderboard from './components/Leaderboard';
import GameHistory from './components/GameHistory';
import Scoreboard from './components/Scoreboard';
import PlayerSelection from './components/PlayerSelection';
import AdminControls from './components/AdminControls';
import InputModal from './components/InputModal';
import dataService from './services/dataService';

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

  const handleGameEnd = (player1, player2, player1Score, player2Score) => {
    const gameResult = dataService.recordGame(player1, player2, player1Score, player2Score);
    updateLeaderboard();
    updateGameHistory();
    setCurrentScreen('main');
    setGameInProgress(false);
    
    // Optionally, you can display a game result message here
    console.log(`Game ended: ${gameResult.winner} beat ${gameResult.loser} [${gameResult.winnerScore}-${gameResult.loserScore}]`);
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

  const handlePlayerSelect = (player, index) => {
    setModalConfig({
      title: `Enter Password for ${player.name}`,
      fields: [
        { name: 'password', label: 'Password', type: 'password' }
      ],
      onSubmit: (values) => {
        if (values.password === dataService.players[player.name].password) {
          const newSelectedPlayers = { ...selectedPlayers };
          newSelectedPlayers[`player${index + 1}`] = player.name;
          setSelectedPlayers(newSelectedPlayers);
          setIsModalOpen(false);
        } else {
          alert('Incorrect password');
        }
      }
    });
    setIsModalOpen(true);
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
        />
      )}
      {currentScreen === 'admin' && (
        <AdminControls onExit={() => setCurrentScreen('main')} />
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
