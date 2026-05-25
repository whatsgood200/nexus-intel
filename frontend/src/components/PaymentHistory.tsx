import React from 'react';
import { DollarSign, ExternalLink } from 'lucide-react';
import type { WorkflowRun } from '../hooks/useAgentData.ts';

interface Props {
  runs: WorkflowRun[];
  totalUSDCSpent: number;
}

const SERVICE_LABELS: Record<string, string> = {
  'ace-search': 'Web Search',
  'ace-llm': 'LLM Analysis',
  'ace-img': 'Image Gen',
};

export default function PaymentHistory({ runs, totalUSDCSpent }: Props) {
  const recentPayments = runs
    .filter((r) => r.totalUSDC > 0)
    .slice(0, 10)
    .map((r) => ({
      runId: r.runId,
      cycleNumber: r.cycleNumber,
      date: r.completedAt || r.startedAt,
      totalUSDC: r.totalUSDC,
      onChainTx: r.onChainTx,
      services: ['ace-search', 'ace-llm', 'ace-img'],
    }));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
          💳 x402 Payment History
        </div>
        <div
          className="font-mono text-sm font-bold"
          style={{ color: 'var(--green)' }}
        >
          ${totalUSDCSpent.toFixed(4)} USDC total
        </div>
      </div>

      {recentPayments.length === 0 ? (
        <div
          className="text-center py-6 font-mono text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          No payments yet. Run a cycle to see x402 USDC payments.
        </div>
      ) : (
        <div className="space-y-2">
          {recentPayments.map((p) => (
            <div
              key={p.runId}
              className="flex items-center justify-between py-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <DollarSign size={14} color="var(--green)" />
                <div>
                  <div className="font-mono text-xs text-[var(--text)]">
                    Cycle #{p.cycleNumber}
                  </div>
                  <div
                    className="font-mono text-[10px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {p.services.map((s) => SERVICE_LABELS[s] || s).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: 'var(--green)' }}
                >
                  ${p.totalUSDC.toFixed(4)}
                </span>
                {p.onChainTx && (
                  <a
                    href={`https://solscan.io/tx/${p.onChainTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink size={12} color="var(--accent)" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-4 pt-3 border-t font-mono text-[10px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        Payments made autonomously via Ace x402 protocol in USDC on Solana mainnet
      </div>
    </div>
  );
}
