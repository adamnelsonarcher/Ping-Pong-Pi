import React, { useState, useRef, useEffect } from 'react';
import './UserAccount.css';

function UserAccount({ currentUser, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    onLogout();
  };

  return (
    <div className="user-account" ref={menuRef}>
      <button className="user-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        Logged In ▼
      </button>
      {isMenuOpen && (
        <div className="user-menu">
          <div className="user-email">{currentUser}</div>
          <button onClick={handleLogoutClick}>Log Out</button>
        </div>
      )}
    </div>
  );
}

export default UserAccount; 