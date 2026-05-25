import React from 'react';
import { ExternalLink, FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ReportMeta {
  reportId: string;
  runId: string;
  cycleNumber: number;
  createdAt: string;
  title: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  wordCount: number;
  assets: string[];
  htmlPath: string;
  onChainTx: string | null;
  coverImageB64: string | null;
}

interface Props {
  report: ReportMeta;
  onOpen: (reportId: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ReportCard({ report, onOpen }: Props) {
  const sentimentConfig = {
    bullish: {
      color: '#00c896',
      bg: 'rgba(0,200,150,0.1)',
      border: 'rgba(0,200,150,0.3)',
      Icon: TrendingUp,
      label: 'BULLISH',
    },
    bearish: {
      color: '#ff4d6b',
      bg: 'rgba(255,77,107,0.1)',
      border: 'rgba(255,77,107,0.3)',
      Icon: TrendingDown,
      label: 'BEARISH',
    },
    neutral: {
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.3)',
      Icon: Minus,
      label: 'NEUTRAL',
    },
  }[report.sentiment];

  const dateStr = new Date(report.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeStr = new Date(report.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Cover Image */}
      <div
        className="relative h-[140px] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d0f1a 0%, #1a1040 50%, #0d0f1a 100%)',
        }}
      >
        {report.coverImageB64 ? (
          <img
            src={`data:image/png;base64,${report.coverImageB64}`}
            alt="Report cover"
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-1">⚡</div>
              <div
                className="font-mono text-xs tracking-widest"
                style={{ color: 'var(--accent)' }}
              >
                NEXUS INTEL
              </div>
            </div>
          </div>
        )}

        {/* Sentiment badge overlay */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold tracking-widest"
          style={{
            background: sentimentConfig.bg,
            color: sentimentConfig.color,
            border: `1px solid ${sentimentConfig.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <sentimentConfig.Icon size={10} />
          {sentimentConfig.label}
        </div>

        <div
          className="absolute top-3 left-3 font-mono text-[10px] px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: 'var(--text-muted)',
            backdropFilter: 'blur(8px)',
          }}
        >
          Cycle #{report.cycleNumber}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div
          className="font-mono text-[10px] mb-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {dateStr} · {timeStr}
        </div>

        <h3
          className="text-sm font-bold leading-tight mb-3 line-clamp-2"
          style={{ color: 'var(--text)', fontFamily: 'Georgia, serif' }}
        >
          {report.title}
        </h3>

        {/* Assets */}
        <div className="flex flex-wrap gap-1 mb-3">
          {report.assets.slice(0, 5).map((asset) => (
            <span
              key={asset}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(108,99,255,0.12)',
                color: '#a0a6d2',
                border: '1px solid rgba(108,99,255,0.25)',
              }}
            >
              {asset}
            </span>
          ))}
        </div>

        {/* Stats row */}
        <div
          className="flex items-center justify-between text-[10px] font-mono pb-3 mb-3 border-b"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            <span style={{ color: 'var(--text)' }}>{report.wordCount.toLocaleString()}</span> words
          </span>
          <span>
            Score:{' '}
            <span
              style={{
                color: sentimentConfig.color,
                fontWeight: 'bold',
              }}
            >
              {report.sentimentScore > 0 ? '+' : ''}
              {(report.sentimentScore * 100).toFixed(0)}
            </span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onOpen(report.reportId)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs font-bold transition-all"
            style={{
              background: 'rgba(108,99,255,0.15)',
              color: 'var(--accent)',
              border: '1px solid rgba(108,99,255,0.35)',
            }}
          >
            <FileText size={12} />
            Open Report
          </button>

          {report.onChainTx && (
            <a
              href={`https://solscan.io/tx/${report.onChainTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-3 py-2 rounded-lg transition-all"
              style={{
                background: 'rgba(0,200,150,0.1)',
                color: '#00c896',
                border: '1px solid rgba(0,200,150,0.25)',
              }}
              title="View on Solscan"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
