import React, { useEffect, useRef, useState } from 'react';
import { Activity, DollarSign, Hash, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAgentData } from '../hooks/useAgentData.ts';
import { useLogs } from '../hooks/useLogs.ts';
import AgentStatusCard from '../components/AgentStatusCard.tsx';
import CycleTimeline from '../components/CycleTimeline.tsx';
import PaymentHistory from '../components/PaymentHistory.tsx';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'var(--accent)',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon size={18} color={color} />
      </div>
      <div>
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </div>
        <div
          className="text-xl font-bold font-mono"
          style={{ color: 'var(--text)' }}
        >
          {value}
        </div>
        {sub && (
          <div
            className="font-mono text-[10px] mt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ nextRunAt }: { nextRunAt: string | null }) {
  const [label, setLabel] = useState('—');

  useEffect(() => {
    if (!nextRunAt) return;
    const update = () => {
      const diff = new Date(nextRunAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('now');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${m}m ${s}s`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [nextRunAt]);

  return <>{label}</>;
}

function LogViewer() {
  const { lines, connected, error } = useLogs();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const levelColor = {
    info: 'var(--text)',
    warn: '#f59e0b',
    error: '#ff4d6b',
    debug: '#9094b0',
    unknown: 'var(--text)',
  };

  return (
    <div className="card flex flex-col h-[320px]">
      <div className="flex items-center justify-between mb-3">
        <div
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          📡 Live Logs
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? '#00c896' : '#ff4d6b' }}
          />
          <span
            className="font-mono text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {connected ? 'CONNECTED' : 'RECONNECTING'}
          </span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
        style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px' }}
      >
        {error && (
          <div style={{ color: '#ff4d6b' }}>{error}</div>
        )}
        {lines.length === 0 && !error && (
          <div style={{ color: 'var(--text-muted)' }}>
            Waiting for log output...
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} style={{ color: levelColor[l.level] }}>
            {l.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { status, runs, isLoading, error } = useAgentData();
  const activeRun = status?.currentRun || (runs[0]?.status === 'running' ? runs[0] : null);
  const displayRun = activeRun || runs[0];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl p-4 font-mono text-sm"
          style={{
            background: 'rgba(255,77,107,0.1)',
            border: '1px solid rgba(255,77,107,0.3)',
            color: '#ff4d6b',
          }}
        >
          ⚠️ API connection issue: {error}. Make sure the agent API server is running on port 3001.
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AgentStatusCard status={status} isLoading={isLoading} />

        <StatCard
          label="Current Cycle"
          value={`#${status?.currentCycle ?? 0}`}
          sub={
            status?.lastRunAt
              ? `Last: ${formatDistanceToNow(new Date(status.lastRunAt), { addSuffix: true })}`
              : 'No cycles run yet'
          }
          icon={Hash}
          color="#6c63ff"
        />

        <StatCard
          label="USDC Spent (Total)"
          value={`$${(status?.totalUSDCSpent ?? 0).toFixed(4)}`}
          sub={`Balance: $${(status?.usdcBalance ?? 0).toFixed(4)} USDC`}
          icon={DollarSign}
          color="#00c896"
        />

        <StatCard
          label="Next Run In"
          value={status?.nextRunAt ? '' : '—'}
          sub={
            status?.nextRunAt
              ? `at ${format(new Date(status.nextRunAt), 'HH:mm')}`
              : 'Cron scheduled'
          }
          icon={Clock}
          color="#f59e0b"
        />
      </div>

      {/* ── Cycle Timeline ── */}
      {displayRun && (
        <CycleTimeline
          steps={displayRun.steps}
          cycleNumber={displayRun.cycleNumber}
        />
      )}

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Runs Table */}
        <div className="card">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            📋 Recent Runs
          </div>

          {runs.length === 0 ? (
            <div
              className="text-center py-8 font-mono text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              No runs yet. Start the agent to begin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cycle', 'Date', 'Status', 'Words', 'USDC', 'Tx'].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-2 font-normal"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 8).map((run) => (
                    <tr
                      key={run.runId}
                      className="border-b"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="py-2" style={{ color: 'var(--accent)' }}>
                        #{run.cycleNumber}
                      </td>
                      <td className="py-2" style={{ color: 'var(--text-muted)' }}>
                        {format(new Date(run.startedAt), 'MM/dd HH:mm')}
                      </td>
                      <td className="py-2">
                        <span className={`badge badge-${run.status}`}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: 'var(--text)' }}>
                        {run.wordCount.toLocaleString()}
                      </td>
                      <td className="py-2" style={{ color: '#00c896' }}>
                        ${run.totalUSDC.toFixed(3)}
                      </td>
                      <td className="py-2">
                        {run.onChainTx ? (
                          <a
                            href={`https://solscan.io/tx/${run.onChainTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:opacity-80"
                            style={{ color: 'var(--accent)' }}
                          >
                            {run.onChainTx.slice(0, 6)}...
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Log Viewer */}
        <LogViewer />
      </div>

      {/* ── Payment History ── */}
      <PaymentHistory
        runs={runs}
        totalUSDCSpent={status?.totalUSDCSpent ?? 0}
      />

      {/* ── Wallet Info ── */}
      {status && (
        <div
          className="rounded-xl p-4 font-mono text-xs"
          style={{
            background: 'rgba(108,99,255,0.06)',
            border: '1px solid rgba(108,99,255,0.2)',
          }}
        >
          <div className="flex flex-wrap gap-6">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Wallet: </span>
              <a
                href={`https://solscan.io/account/${status.agentAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
              >
                {status.agentAddress.slice(0, 8)}...{status.agentAddress.slice(-6)}
                <ExternalLink size={10} className="inline ml-1" />
              </a>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SOL: </span>
              <span style={{ color: 'var(--text)' }}>{status.solBalance.toFixed(4)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>USDC: </span>
              <span style={{ color: '#00c896' }}>{status.usdcBalance.toFixed(4)}</span>
            </div>
            {status.registration && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>SAP Agent: </span>
                <a
                  href={`https://explorer.oobeprotocol.ai/agents/${status.registration.agentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  View on Explorer <ExternalLink size={10} className="inline ml-1" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
