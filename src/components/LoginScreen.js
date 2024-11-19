import React, { useEffect, useRef } from 'react';
import './LoginScreen.css';
import dataService from '../services/dataService';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

function LoginScreen({ onLogin }) {
  const canvasRef = useRef(null);
  const ballRef = useRef({
    x: 100,
    y: 100,
    dx: 4,
    dy: 4,
    radius: 8
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const drawBall = () => {
      const ball = ballRef.current;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.closePath();
      
      // Update position
      ball.x += ball.dx;
      ball.y += ball.dy;
      
      // Bounce off walls
      if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
        ball.dx = -ball.dx;
      }
      if (ball.y + ball.dy > canvas.height - ball.radius || ball.y + ball.dy < ball.radius) {
        ball.dy = -ball.dy;
      }
      
      animationFrameId = requestAnimationFrame(drawBall);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    drawBall();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      // Check if local data exists
      const localData = localStorage.getItem('localGameData');
      if (localData) {
        const confirmed = window.confirm(
          'WARNING: Signing in with Google will remove your local save data. ' +
          'Please download your save data from the admin panel first if you want to keep it.\n\n' +
          'Do you want to continue?'
        );
        
        if (!confirmed) {
          return;
        }
      }
      
      // Proceed with Google login
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result.user || !result.user.email) {
        throw new Error('No user email found');
      }
      
      const email = result.user.email;
      dataService.setLocalMode(false);
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
      <canvas ref={canvasRef} className="background-canvas" />
      <div className="login-content">
        <div className="logo-container">
          <h1>🏓</h1>
          <h2>Ping Pong Pi</h2>
          <p className="subtitle">A scoreboard display to track ping pong scores and display stats</p>
        </div>
        <div className="login-buttons">
          <button 
            className="google-login-btn" 
            onClick={handleGoogleLogin}
          >
            <span className="btn-icon">G</span>
            <span className="btn-text">Login with Google</span>
          </button>
          <div className="divider">
            <span>or</span>
          </div>
          <button 
            className="local-login-btn" 
            onClick={handleLocalLogin}
          >
            <span className="btn-icon">💾</span>
            <span className="btn-text">Use Local Storage</span>
          </button>
        </div>
      </div>
      <div className="attribution">
        by <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">Adam Nelson-Archer</a>
      </div>
    </div>
  );
}

export default LoginScreen; 