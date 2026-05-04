import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface SevIconProps {
  sev: 'critical' | 'high' | 'medium' | 'low' | 'info';
  size?: number;
}

export const SevIcon: React.FC<SevIconProps> = ({ sev, size = 14 }) => {
  const props = { size };
  if (sev === 'critical') return <AlertCircle {...props} color="#ef4444" />;
  if (sev === 'high') return <AlertTriangle {...props} color="#f97316" />;
  if (sev === 'medium') return <AlertTriangle {...props} color="#eab308" />;
  if (sev === 'low') return <Info {...props} color="#22c55e" />;
  return <Info {...props} color="#3b82f6" />;
};
