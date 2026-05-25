import React from 'react';
import { Zap, AlertCircle, Clock } from 'lucide-react';
import type { AgentStatus } from '../hooks/useAgentData.ts';

interface Props {
  status: AgentStatus | null;
  isLoading: boolean;
}

export default function AgentStatusCard({ status, isLoading }: Props) {
  if (isLoading || !status) {
    return (
      <div className="card flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[var(--text-muted)] animate-pulse" />
        <div>
          <div className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">
            Agent Status
          </div>
          <div className="text-base font-bold text-[var(--text-muted)]">Loading...</div>
        </div>
      </div>
    );
  }

  const isRunning = status.isRunning;
  const color = isRunning ? '#6c63ff' : '#00c896';
  const label = isRunning ? 'RUNNING' : 'IDLE';

  return (
    <div className="card flex items-center gap-4">
      <div className="relative">
        <div
          className="w-4 h-4 rounded-full"
          style={{ background: color }}
        />
        {isRunning && (
          <div
            className="absolute inset-0 w-4 h-4 rounded-full animate-ping"
            style={{ background: color, opacity: 0.6 }}
          />
        )}
      </div>
      <div className="flex-1">
        <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1">
          Agent Status
        </div>
        <div
          className="text-lg font-bold font-mono tracking-widest"
          style={{ color }}
        >
          {label}
        </div>
        {status.registration && (
          <div className="font-mono text-[10px] text-[var(--text-muted)] mt-1 truncate max-w-[180px]">
            {status.registration.name}
          </div>
        )}
      </div>
      {isRunning ? (
        <Zap size={20} color={color} className="opacity-80" />
      ) : status.error ? (
        <AlertCircle size={20} color="#ff4d6b" />
      ) : (
        <Clock size={20} color={color} className="opacity-60" />
      )}
    </div>
  );
}
