import React, { useState, useEffect, useRef } from 'react';
import './InputModal.css';

/**
 * Small prompt used for player passwords and adding players.
 *
 * `fields` entries are `{ name, label, type?, required?, hint? }`. Fields are
 * required by default; pass `required: false` for genuinely optional input.
 */
function InputModal({ isOpen, onClose, title, fields = [], onSubmit, onCancel }) {
  const [values, setValues] = useState({});
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValues({});
      // Focus the first field so a keyboard user can just start typing.
      const timer = setTimeout(() => firstInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onCancel, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" role="dialog" aria-modal="true" aria-label={title}>
        <h3 className="modal-title">{title}</h3>
        <form onSubmit={handleSubmit}>
          {fields.map((field, index) => (
            <div key={field.name} className="input-group">
              <input
                ref={index === 0 ? firstInputRef : null}
                type={field.type || 'text'}
                id={field.name}
                value={values[field.name] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                placeholder={field.label}
                aria-label={field.label}
                required={field.required !== false}
              />
              {field.hint && <p className="input-hint">{field.hint}</p>}
            </div>
          ))}
          <div className="modal-buttons">
            <button type="submit">Submit</button>
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InputModal;
