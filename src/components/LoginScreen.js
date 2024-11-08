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
      
      // Create/verify user and set as current
      console.log('Creating/verifying user...');
      const success = await dataService.createUser(email, 'google-auth');
      console.log('Create/verify user result:', success);
      
      if (!success) {
        throw new Error('Failed to create/verify user');
      }
      
      // Ensure data is loaded before proceeding
      await dataService.loadData();
      
      // Set the current user in localStorage
      localStorage.setItem('currentUser', email);
      
      // Notify parent of successful login
      console.log('Login successful, notifying parent...');
      onLogin(email);
    } catch (error) {
      console.error('Google login error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      if (error.code !== 'auth/cancelled-popup-request') {
        alert('Failed to login with Google. Please try again.');
      }
      // Reset everything on error
      dataService.currentUser = null;
      localStorage.removeItem('currentUser');
    }
  };

  return (
    <div className="login-screen">
      <h2>Welcome to Ping Pong Scoreboard</h2>
      <button 
        className="google-login-btn" 
        onClick={handleGoogleLogin}
      >
        Login with Google
      </button>
    </div>
  );
}

export default LoginScreen; 