import React, { useEffect, useRef, useState } from 'react';
import './LoginScreen.css';
import dataService from '../services/dataService';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

function LoginScreen({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);
      const localData = localStorage.getItem('localGameData');
      if (localData) {
        const confirmed = window.confirm(
          'WARNING: Signing in with Google will remove your local save data. ' +
          'Please download your save data from the admin panel first if you want to keep it.\n\n' +
          'Do you want to continue?'
        );
        
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
      }
      
      await auth.signOut();
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
      if (error.code === 'auth/popup-closed-by-user') {
        setIsLoading(false);
        return;
      }
      alert(`Failed to login with Google: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleLocalLogin = async () => {
    try {
      setIsLoading(true);
      const localId = 'local_user';
      dataService.setLocalMode(true);
      localStorage.setItem('currentUser', localId);
      localStorage.setItem('isLocalMode', 'true');
      
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
      
      await dataService.loadData();
      onLogin(localId);
    } catch (error) {
      console.error('Local login error:', error);
      alert('Failed to initialize local storage. Please try again.');
      localStorage.removeItem('localGameData');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLocalMode');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <canvas ref={canvasRef} className="background-canvas" />
      {isLoading ? (
        <div className="login-content">
          <div className="loading-message">
            <h2>Signing in...</h2>
          </div>
        </div>
      ) : (
        <div className="login-content">
          <div className="logo-container">
            <h1>🏓</h1>
            <h2>Ping Pong Pi</h2>
            <p className="subtitle">A scoreboard display to track ping pong scores and display stats</p>
          </div>
          <div className="login-buttons">
            <div className="login-button-container">
              <button 
                className="local-login-btn" 
                onClick={handleLocalLogin}
              >
                <span className="btn-icon">💾</span>
                <span className="btn-text">Use Local Storage</span>
              </button>
              <span className="button-subtext">Stores data on this device only</span>
            </div>
            
            <div className="divider">
              <span>or</span>
            </div>
            
            <div className="login-button-container">
              <button 
                className="google-login-btn" 
                onClick={handleGoogleLogin}
              >
                <span className="btn-icon">G</span>
                <span className="btn-text">Login with Google</span>
              </button>
              <span className="button-subtext">Saves data to server, allows for sync between computers</span>
            </div>
          </div>
        </div>
      )}
      <div className="attribution">
        by <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">Adam Nelson-Archer</a>
      </div>
    </div>
  );
}

export default LoginScreen; 