import React from 'react';
import './LoginScreen.css';
import dataService from '../services/dataService';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

function LoginScreen({ onLogin }) {
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result.user || !result.user.email) {
        throw new Error('No user email found');
      }
      
      const email = result.user.email;
      dataService.setLocalMode(false); // Ensure server mode for Google login
      localStorage.setItem('currentUser', email);
      onLogin(email);
    } catch (error) {
      console.error('Google login error:', error);
      if (error.code !== 'auth/cancelled-popup-request') {
        alert('Failed to login with Google. Please try again.');
      }
      dataService.currentUser = null;
      localStorage.removeItem('currentUser');
    }
  };

  const handleLocalLogin = async () => {
    try {
      const localId = 'local_user';
      dataService.setLocalMode(true);
      localStorage.setItem('currentUser', localId);
      
      // Initialize local storage if it doesn't exist
      if (!localStorage.getItem('localGameData')) {
        const defaultData = {
          settings: {
            SCORE_CHANGE_K_FACTOR: 70,
            POINT_DIFFERENCE_WEIGHT: 6,
            ACTIVITY_THRESHOLD: 3,
            DEFAULT_RANK: "Unranked",
            PLAYER1_SCOREBOARD_COLOR: "#4CAF50",
            PLAYER2_SCOREBOARD_COLOR: "#2196F3",
            GAME_HISTORY_KEEP: 30,
            ADDPLAYER_ADMINONLY: false,
            ADMIN_PASSWORD: ""
          },
          players: {},
          gameHistory: []
        };
        localStorage.setItem('localGameData', JSON.stringify(defaultData));
      }
      
      onLogin(localId);
    } catch (error) {
      console.error('Local login error:', error);
      alert('Failed to initialize local storage. Please try again.');
      localStorage.removeItem('localGameData');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLocalMode');
    }
  };

  return (
    <div className="login-screen">
      <h2>Welcome to Ping Pong Scoreboard</h2>
      <div className="login-buttons">
        <button 
          className="google-login-btn" 
          onClick={handleGoogleLogin}
        >
          Login with Google
        </button>
        <button 
          className="local-login-btn" 
          onClick={handleLocalLogin}
        >
          Use Local Storage
        </button>
      </div>
    </div>
  );
}

export default LoginScreen; 