import React from 'react';
import './LoginScreen.css';
import dataService from '../services/dataService';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

function LoginScreen({ onLogin }) {
  const handleGoogleLogin = async () => {
    try {
      console.log('Starting Google login process...');
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result.user || !result.user.email) {
        throw new Error('No user email found');
      }
      
      const email = result.user.email;
      console.log('Got email:', email);
      
      // First check if this is a new account
      const checkResponse = await fetch('http://localhost:3001/api/getData');
      const data = await checkResponse.json();
      const isNewAccount = !data.users[email];

      if (isNewAccount) {
        // For new accounts, create the account first
        const newUserData = {
          ...data,
          users: {
            ...data.users,
            [email]: {
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
            }
          }
        };

        // Save the new user data
        const saveResponse = await fetch('http://localhost:3001/api/saveData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newUserData)
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save new user data');
        }
      }
      
      // Now proceed with normal login
      const { success } = await dataService.createUser(email, 'google-auth');
      
      if (!success) {
        throw new Error('Failed to initialize user');
      }

      // Set the current user in localStorage
      localStorage.setItem('currentUser', email);
      
      // Notify parent of successful login
      console.log('Login successful, notifying parent...');
      onLogin(email, isNewAccount);
    } catch (error) {
      console.error('Google login error details:', error);
      if (error.code !== 'auth/cancelled-popup-request') {
        alert('Failed to login with Google. Please try again.');
      }
      dataService.currentUser = null;
      localStorage.removeItem('currentUser');
    }
  };

  const handleLocalLogin = async () => {
    try {
      // Check if we already have local data
      const localData = localStorage.getItem('localGameData');
      const localId = localStorage.getItem('localUserId') || 'local_user';
      
      if (!localData) {
        // Only initialize if no data exists
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
        localStorage.setItem('localUserId', localId);
      }
      
      // Set local mode and user
      dataService.setLocalMode(true);
      localStorage.setItem('isLocalMode', 'true');
      localStorage.setItem('currentUser', localId);
      
      // Load existing data and login
      await dataService.setCurrentUser(localId);
      onLogin(localId, !localData);
    } catch (error) {
      console.error('Local login error:', error);
      alert('Failed to initialize local storage. Please try again.');
    }
  };

  return (
    <div className="login-screen">
      <h2>Welcome to Ping Pong Scoreboard</h2>
      <div className="login-buttons">
        <button className="google-login-btn" onClick={handleGoogleLogin}>
          Login with Google
        </button>
        <button className="local-login-btn" onClick={handleLocalLogin}>
          Use Local Storage
        </button>
      </div>
    </div>
  );
}

export default LoginScreen; 