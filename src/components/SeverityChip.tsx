import React from 'react';

interface SeverityChipProps {
  sev: 'critical' | 'high' | 'medium' | 'low' | 'info';
  small?: boolean;
}

export const SeverityChip: React.FC<SeverityChipProps> = ({ sev, small }) => (
  <span
    className={`sev-chip sev-${sev}`}
    style={small ? { fontSize: '10px', padding: '2px 7px' } : {}}
  >
    {sev.toUpperCase()}
  </span>
);
