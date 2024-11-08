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
        Info
      </button>
      
      {isOpen && (
        <div className="modal-overlay">
          <div className="info-popup">
            <div className="info-content">
              <h3>About</h3>
              <p>Created by Ethan Okamura</p>
              <p>
                <a 
                  href="https://ethanokamura.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Visit my website
                </a>
              </p>
              
              <div className="account-section">
                <h3>Account</h3>
                <p className="user-email">{currentUser}</p>
                <button className="logout-button" onClick={onLogout}>Logout</button>
              </div>
            </div>
            <button 
              className="close-btn"
              onClick={() => setIsOpen(false)}
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