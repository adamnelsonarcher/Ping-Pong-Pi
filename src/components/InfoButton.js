import React, { useState } from 'react';
import './InfoButton.css';

function InfoButton({ currentUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        className="btn info-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="info-icon">i</span>
      </button>
      
      {isOpen && (
        <div className="modal-overlay">
          <div className="info-popup">
            <div className="info-content">
              <div className="version-header">
                <h2>Ping Pong Pi</h2>
                <div className="version-info">
                  <span className="version-tag">Version 2.5</span>
                  <a 
                    href="https://github.com/adamnelsonarcher/Ping-Pong-Pi/releases" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="changelog-link"
                  >
                    View Changelog
                  </a>
                </div>
              </div>
              
              <section className="info-section">
                <h3>About</h3>
                <p>
                  Designed and developed by <strong>Adam Nelson-Archer</strong>
                  {' '}
                  <a 
                    href="https://nelsonarcher.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="personal-link"
                  >
                    (Check out my website)
                  </a>
                </p>
                <p>Thanks to <strong>Evan Holfland</strong> for planting the seed of this idea in my mind</p>
                <p> </p>
                <div className="links-container">
                <a 
                    href="https://nelsonarcher.com/demos" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="info-link"
                  >
                    <span className="link-icon">🌐</span>
                    See where my demos are hosted
                  </a>
                  <a 
                    href="https://github.com/adamnelsonarcher/Ping-Pong-Pi/tree/Webapp" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="info-link"
                  >
                    <span className="link-icon">📂</span>
                    View Source Code
                  </a>
                </div>
              </section>
              
              <section className="info-section account-section">
                <h3>Account</h3>
                <p className="user-email">
                  <span className="email-label">Logged in as:</span>
                  <br />
                  {currentUser}
                </p>
                <button className="logout-button" onClick={onLogout}>
                  Sign Out
                </button>
              </section>
            </div>
            <button 
              className="close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default InfoButton; 