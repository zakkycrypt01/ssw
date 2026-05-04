import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToolResult {
  status: 'idle' | 'running' | 'done';
  message?: string;
}

interface ToolStatusProps {
  name: string;
  result: ToolResult;
}

export const ToolStatus: React.FC<ToolStatusProps> = ({ name, result }) => {
  const dot =
    result.status === 'done' ? (
      <CheckCircle2 size={14} color="#84cc16" />
    ) : result.status === 'running' ? (
      <span
        className="animate-pulse-glow"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--color-lemon)',
        }}
      />
    ) : (
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#334155',
        }}
      />
    );

  return (
    <div className="tool-status-card">
      {dot}
      <div>
        <div className="tool-name">{name}</div>
        <div className="tool-msg">{result.message || 'Queued'}</div>
      </div>
    </div>
  );
};
