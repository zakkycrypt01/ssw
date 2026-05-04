import React, { useState } from 'react';

interface NewFileModalProps {
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({ onConfirm, onClose }) => {
  const [name, setName] = useState('');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">New File</div>
        <input
          className="modal-input"
          autoFocus
          placeholder="filename.rs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
