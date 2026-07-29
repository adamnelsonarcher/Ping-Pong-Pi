import React from 'react';
import './LoadingScreen.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <h1>🏓</h1>
        <div className="loading-spinner"></div>
        <h2 className="loading-text">Loading Game Data...</h2>
      </div>
    </div>
  );
}

export default LoadingScreen;
