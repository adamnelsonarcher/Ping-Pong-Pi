import { useEffect, useRef, useState } from 'react';
import './LoginScreen.css';
import dataService from '../services/dataService';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup } from 'firebase/auth';

const LOCAL_USER_ID = 'local_user';

function LoginScreen({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const ball = { x: 100, y: 100, dx: 4, dy: 4, radius: 8 };
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const drawBall = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.closePath();

      ball.x += ball.dx;
      ball.y += ball.dy;

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
    if (!prefersReducedMotion) drawBall();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  /**
   * Sign in with Google.
   *
   * This deliberately does not write localStorage or load any data: App owns
   * that, and its error path clears the session if the load fails. The old
   * version wrote the identity to localStorage *before* the risky work, so an
   * interrupted login left a value behind that crashed the next page load
   * (docs/AUDIT.md D-06).
   */
  const handleGoogleLogin = async () => {
    setError('');
    try {
      setIsLoading(true);

      const hasLocalData = localStorage.getItem('localGameData');
      if (localStorage.getItem('isLocalMode') === 'true' && hasLocalData) {
        const confirmed = window.confirm(
          'Signing in with Google switches this device to cloud storage.\n\n' +
            'Your local save stays on this device but will not be used. Download it ' +
            'from the admin panel first if you want to import it into your account.\n\n' +
            'Continue?'
        );
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
      }

      await auth.signOut();
      const result = await signInWithPopup(auth, googleProvider);

      if (!result.user?.email) {
        throw new Error('That Google account has no email address.');
      }

      dataService.setLocalMode(false);
      onLogin(result.user.email);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setIsLoading(false);
        return;
      }
      console.error('Google login error:', err);
      setError(err.message || 'Failed to sign in with Google.');
      setIsLoading(false);
    }
  };

  const handleLocalLogin = async () => {
    setError('');
    try {
      setIsLoading(true);
      dataService.setLocalMode(true);

      if (!localStorage.getItem('localGameData')) {
        localStorage.setItem(
          'localGameData',
          JSON.stringify({
            settings: { ...dataService.defaultSettings, ADMIN_PASSWORD: '' },
            players: {},
            gameHistory: [],
          })
        );
      }

      onLogin(LOCAL_USER_ID);
    } catch (err) {
      console.error('Local login error:', err);
      setError('Failed to initialise local storage. Browser storage may be disabled.');
      dataService.setLocalMode(false);
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
            <p className="subtitle">
              A scoreboard display to track ping pong scores and display stats
            </p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="login-buttons">
            <div className="login-button-container">
              <button className="local-login-btn" onClick={handleLocalLogin}>
                <span className="btn-icon">💾</span>
                <span className="btn-text">Use Local Storage</span>
              </button>
              <span className="button-subtext">Stores data on this device only</span>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <div className="login-button-container">
              <button className="google-login-btn" onClick={handleGoogleLogin}>
                <span className="btn-icon">G</span>
                <span className="btn-text">Login with Google</span>
              </button>
              <span className="button-subtext">
                Saves data to the server, allows sync between computers
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="attribution">
        by{' '}
        <a href="https://nelsonarcher.com" target="_blank" rel="noopener noreferrer">
          Adam Nelson-Archer
        </a>
      </div>
    </div>
  );
}

export default LoginScreen;
