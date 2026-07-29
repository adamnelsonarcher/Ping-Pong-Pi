import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import './App.css';
import Leaderboard from './components/Leaderboard';
import GameHistory from './components/GameHistory';
import Scoreboard from './components/Scoreboard';
import PlayerSelection from './components/PlayerSelection';
import AdminControls from './components/AdminControls';
import InputModal from './components/InputModal';
import Toast from './components/Toast';
import dataService from './services/dataService';
import { useSettings } from './contexts/SettingsContext';
import LoginScreen from './components/LoginScreen';
import AdminPasswordPrompt from './components/AdminPasswordPrompt';
import InfoButton from './components/InfoButton';
import LoadingScreen from './components/LoadingScreen';

const subscribe = (listener) => dataService.subscribe(listener);
const getVersion = () => dataService.version;

function App() {
  const [currentUser, setCurrentUser] = useState(() => dataService.currentUser);
  const [currentScreen, setCurrentScreen] = useState('main');
  const [selectedPlayers, setSelectedPlayers] = useState({ player1: '', player2: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { settings } = useSettings();

  // Re-render whenever dataService changes, and read straight from it. There is
  // no second copy of players/leaderboard/history to drift out of sync — which is
  // how admin edits used to fail to appear on the leaderboard.
  useSyncExternalStore(subscribe, getVersion);
  const leaderboard = dataService.getLeaderboard();
  const gameHistory = dataService.getGameHistory();
  const players = dataService.getPlayers();

  const notify = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await dataService.flush();
    } catch {
      /* logging out is more important than the last save landing */
    }
    localStorage.removeItem('currentUser');
    // isLocalMode used to be cleared only when *not* in local mode, so logging
    // out of local mode left the flag set and the next Google login started in
    // the wrong mode (docs/AUDIT.md L-14).
    localStorage.removeItem('isLocalMode');
    dataService.setLocalMode(false);
    dataService.clearCurrentUser();

    setSelectedPlayers({ player1: '', player2: '' });
    setCurrentScreen('main');
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialiseApp = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        dataService.setLocalMode(localStorage.getItem('isLocalMode') === 'true');
        await dataService.setCurrentUser(currentUser);
        if (cancelled) return;

        setShowAdminPasswordPrompt(!dataService.hasAdminPassword());
        setCurrentScreen('main');
      } catch (error) {
        if (cancelled) return;
        console.error('Error initializing app:', error);
        notify('Could not load your data. Please sign in again.', 'error');
        handleLogout();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialiseApp();
    return () => {
      cancelled = true;
    };
  }, [currentUser, handleLogout, notify]);

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (showAdminPasswordPrompt) {
    return (
      <AdminPasswordPrompt
        onSubmit={async (password) => {
          try {
            await dataService.setAdminPasswordValue(password);
            setShowAdminPasswordPrompt(false);
            setCurrentScreen('main');
          } catch (error) {
            console.error('Error setting admin password:', error);
            notify('Failed to set admin password. Please try again.', 'error');
          }
        }}
        message="Please set a password for accessing the settings dashboard."
      />
    );
  }

  const closeModal = () => setIsModalOpen(false);

  const handleAddPlayer = () => {
    setModalConfig({
      title: 'Add New Player',
      fields: [
        { name: 'playerName', label: 'Player Name' },
        {
          name: 'password',
          label: 'Password (optional)',
          type: 'password',
          required: false,
          hint: 'Stops someone picking your name by mistake. Leave blank to skip.',
        },
      ],
      onSubmit: async (values) => {
        const result = await dataService.addPlayer(values.playerName, values.password);
        if (!result.ok) {
          // Previously this failure was swallowed and the modal closed as if it
          // had worked (docs/AUDIT.md L-13).
          notify(result.reason, 'error');
          return;
        }
        notify(`Added ${values.playerName.trim()}.`);
        closeModal();
      },
    });
    setIsModalOpen(true);
  };

  const handleClearSelections = () => {
    setSelectedPlayers({ player1: '', player2: '' });
  };

  const handleStartGame = () => {
    if (!selectedPlayers.player1 || !selectedPlayers.player2) {
      notify('Select two players before starting a game.', 'error');
      return;
    }
    if (selectedPlayers.player1 === selectedPlayers.player2) {
      notify('A player cannot play against themselves.', 'error');
      return;
    }
    setCurrentScreen('game');
  };

  const setPlayerAt = (index, name) =>
    setSelectedPlayers((prev) => ({ ...prev, [`player${index + 1}`]: name }));

  const handlePlayerSelect = (playerName, index) => {
    if (playerName === '') {
      setPlayerAt(index, '');
      return;
    }

    const player = dataService.players[playerName];
    if (!player) return;

    // An empty password means this player did not set one; don't demand it.
    if (!player.password) {
      setPlayerAt(index, playerName);
      return;
    }

    setModalConfig({
      title: `Enter Password for ${playerName}`,
      fields: [{ name: 'password', label: 'Password', type: 'password' }],
      onSubmit: async (values) => {
        if (await dataService.checkPlayerPassword(playerName, values.password)) {
          setPlayerAt(index, playerName);
          closeModal();
        } else {
          notify('Incorrect password.', 'error');
        }
      },
      onCancel: () => setPlayerAt(index, ''),
    });
    setIsModalOpen(true);
  };

  const handleAdminClick = () => {
    setModalConfig({
      title: 'Enter Admin Password',
      fields: [{ name: 'password', label: 'Password', type: 'password' }],
      onSubmit: async (values) => {
        if (await dataService.checkAdminPassword(values.password)) {
          setCurrentScreen('admin');
          closeModal();
        } else {
          notify('Incorrect admin password.', 'error');
        }
      },
    });
    setIsModalOpen(true);
  };

  const returnToMain = () => {
    setCurrentScreen('main');
    handleClearSelections();
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
              <button className="btn clear-selections" onClick={handleClearSelections}>
                Clear Selections
              </button>
              <button className="btn start-game" onClick={handleStartGame}>
                Start Game
              </button>
            </div>
            <div className="admin-buttons">
              {!settings?.ADDPLAYER_ADMINONLY && (
                <button className="btn add-player" onClick={handleAddPlayer}>
                  Add Player
                </button>
              )}
              <button className="btn admin-open-btn" onClick={handleAdminClick}>
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
          onGameEnd={returnToMain}
          onQuitGame={returnToMain}
          onNotify={notify}
        />
      )}

      {currentScreen === 'admin' && (
        <AdminControls
          onExit={() => setCurrentScreen('main')}
          onAddPlayer={handleAddPlayer}
          onNotify={notify}
          onAccountErased={handleLogout}
        />
      )}

      <InputModal isOpen={isModalOpen} onClose={closeModal} {...modalConfig} />
      {toast && <Toast key={toast.id} {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default App;
