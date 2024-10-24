import React, { useState, useEffect } from 'react';
import './InputModal.css';

function InputModal({ isOpen, onClose, title, fields, onSubmit }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Clear the values when the modal opens
      setValues({});
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">{title}</h3>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div key={field.name} className="input-group">
              <input
                type={field.type || 'text'}
                id={field.name}
                value={values[field.name] || ''}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                placeholder={field.label}
                required
              />
            </div>
          ))}
          <div className="modal-buttons">
            <button type="submit">Submit</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InputModal;
