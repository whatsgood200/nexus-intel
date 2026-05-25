import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, RefreshCw, Link2 } from 'lucide-react';
import { format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || '';

interface OnChainMemo {
  agent: string;
  net: string;
  run: string;
  cycle: number;
  status: string;
  report: string;
  words: number;
  svcs: string[];
  usdc: number;
  ts: number;
}

interface OnChainRecord {
  txSignature: string;
  memo: OnChainMemo;
  solscanUrl: string;
  confirmedAt: string;
}

interface Registration {
  agentId: string;
  pdaAddress: string;
  txSignature: string;
  name: string;
  registeredAt: string;
  network: string;
}

function MemoDetail({ memo }: { memo: OnChainMemo }) {
  return (
    <div
      className="mt-3 p-4 rounded-xl font-mono text-xs"
      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Agent', value: memo.agent },
          { label: 'Network', value: memo.net.toUpperCase() },
          { label: 'Cycle', value: `#${memo.cycle}` },
          { label: 'Run ID', value: memo.run },
          { label: 'Status', value: memo.status.toUpperCase() },
          { label: 'Report', value: memo.report },
          { label: 'Words', value: memo.words.toLocaleString() },
          { label: 'USDC Spent', value: `$${memo.usdc.toFixed(4)}` },
          {
            label: 'Timestamp',
            value: format(new Date(memo.ts * 1000), 'yyyy-MM-dd HH:mm:ss'),
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ color: 'var(--text-muted)' }}>Services Used</div>
        <div className="flex flex-wrap gap-2 mt-1">
          {memo.svcs.map((s) => (
            <span
              key={s}
              className="px-2 py-0.5 rounded"
              style={{
                background: 'rgba(108,99,255,0.15)',
                color: '#a0a6d2',
                border: '1px solid rgba(108,99,255,0.3)',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OnChain() {
  const [records, setRecords] = useState<OnChainRecord[]>([]);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [agentAddress, setAgentAddress] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recordsRes, statusRes, regRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/onchain`),
        fetch(`${API_URL}/api/status`),
        fetch(`${API_URL}/api/registration`),
      ]);

      if (recordsRes.status === 'fulfilled' && recordsRes.value.ok) {
        const data = (await recordsRes.value.json()) as { records: OnChainRecord[] };
        setRecords(data.records);
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const data = (await statusRes.value.json()) as { agentAddress: string };
        setAgentAddress(data.agentAddress || '');
      }

      if (regRes.status === 'fulfilled' && regRes.value.ok) {
        const data = (await regRes.value.json()) as Registration;
        setRegistration(data);
      }
    } catch (err) {
      console.error('Failed to fetch on-chain data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'Georgia, serif', color: 'var(--text)' }}
          >
            On-Chain Verification
          </h1>
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Immutable audit trail on Solana mainnet via SPL Memo program
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        >
          <RefreshCw size={16} color="var(--text-muted)" />
        </button>
      </div>

      {/* Agent & Registration Links */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          🔗 Agent Registration
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
          {registration ? (
            <>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Agent Name</div>
                <div style={{ color: 'var(--text)' }} className="font-bold">
                  {registration.name}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Network</div>
                <div style={{ color: '#00c896' }} className="font-bold uppercase">
                  {registration.network}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Registered</div>
                <div style={{ color: 'var(--text)' }}>
                  {format(new Date(registration.registeredAt), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div style={{ color: 'var(--text-muted)' }}>Agent ID / PDA</div>
                <div
                  className="flex items-center gap-2 mt-0.5"
                  style={{ color: 'var(--accent)' }}
                >
                  <span className="truncate">{registration.agentId}</span>
                  <a
                    href={`https://explorer.oobeprotocol.ai/agents/${registration.agentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Registration TX</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={`https://solscan.io/tx/${registration.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)' }}
                    className="flex items-center gap-1"
                  >
                    {registration.txSignature.slice(0, 12)}...
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div
              className="col-span-3 py-4"
              style={{ color: 'var(--text-muted)' }}
            >
              Agent not yet registered. Run:{' '}
              <code
                className="px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--accent)' }}
              >
                npm run register
              </code>
            </div>
          )}
        </div>

        {agentAddress && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 font-mono text-xs" style={{ borderColor: 'var(--border)' }}>
            <a
              href={`https://solscan.io/account/${agentAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              style={{ color: 'var(--accent)' }}
            >
              <Link2 size={12} />
              Wallet on Solscan ↗
            </a>
            {registration && (
              <a
                href={`https://explorer.oobeprotocol.ai/agents/${registration.agentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5"
                style={{ color: 'var(--accent)' }}
              >
                <Link2 size={12} />
                Agent on Synapse Explorer ↗
              </a>
            )}
            <a
              href="https://solscan.io/address/MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
              style={{ color: 'var(--accent)' }}
            >
              <Link2 size={12} />
              SPL Memo Program ↗
            </a>
          </div>
        )}
      </div>

      {/* Memo Transactions */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            📜 On-Chain Memo Transactions ({records.length})
          </div>
          <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            SPL Memo Program · Solana Mainnet
          </div>
        </div>

        {isLoading && (
          <div className="p-8 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading on-chain records...
          </div>
        )}

        {!isLoading && records.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">⛓️</div>
            <div className="font-mono text-sm mb-1" style={{ color: 'var(--text)' }}>
              No on-chain records yet
            </div>
            <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Memo transactions are written to Solana mainnet after each successful cycle.
            </div>
          </div>
        )}

        {records.map((record, i) => (
          <div
            key={record.txSignature}
            className="border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              onClick={() =>
                setExpandedTx(
                  expandedTx === record.txSignature ? null : record.txSignature
                )
              }
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0"
                  style={{
                    background: 'rgba(0,200,150,0.1)',
                    color: '#00c896',
                    border: '1px solid rgba(0,200,150,0.25)',
                  }}
                >
                  #{record.memo.cycle}
                </div>
                <div>
                  <div className="font-mono text-xs" style={{ color: 'var(--text)' }}>
                    {record.txSignature.slice(0, 20)}...{record.txSignature.slice(-8)}
                  </div>
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(record.confirmedAt), 'MMM d, yyyy · HH:mm:ss')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className="font-mono text-[10px] font-bold px-2 py-1 rounded"
                  style={{
                    background: 'rgba(0,200,150,0.1)',
                    color: '#00c896',
                    border: '1px solid rgba(0,200,150,0.2)',
                  }}
                >
                  CONFIRMED
                </span>
                <div className="font-mono text-xs" style={{ color: '#00c896' }}>
                  ${record.memo.usdc.toFixed(4)} USDC
                </div>
                <a
                  href={record.solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--accent)' }}
                >
                  <ExternalLink size={14} />
                </a>
                {expandedTx === record.txSignature ? (
                  <ChevronUp size={14} color="var(--text-muted)" />
                ) : (
                  <ChevronDown size={14} color="var(--text-muted)" />
                )}
              </div>
            </div>

            {expandedTx === record.txSignature && (
              <div className="px-5 pb-4">
                <MemoDetail memo={record.memo} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div
        className="mt-4 rounded-xl p-4 font-mono text-xs"
        style={{
          background: 'rgba(108,99,255,0.06)',
          border: '1px solid rgba(108,99,255,0.2)',
        }}
      >
        <div className="font-bold mb-1" style={{ color: 'var(--accent)' }}>
          How on-chain logging works
        </div>
        <div style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
          After each successful workflow cycle, Nexus Intel writes a compact JSON summary to the Solana blockchain
          using the SPL Memo program (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr). This creates an
          immutable, timestamped audit trail linking each intelligence report to on-chain proof of autonomous
          operation. Every memo is signed by the agent wallet and costs ~0.000005 SOL in tx fees.
        </div>
      </div>
    </div>
  );
}
