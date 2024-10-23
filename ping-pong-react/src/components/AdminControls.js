import React from 'react';

function AdminControls({ onExit }) {
  return (
    <div className="AdminControls">
      <h2>Admin Controls</h2>
      <button onClick={() => alert('Reset scores functionality to be implemented')}>Reset All Scores</button>
      <button onClick={() => alert('Edit player functionality to be implemented')}>Edit Player</button>
      <button onClick={() => alert('Delete player functionality to be implemented')}>Delete Player</button>
      <button onClick={onExit}>Exit Admin Controls</button>
    </div>
  );
}

export default AdminControls;
