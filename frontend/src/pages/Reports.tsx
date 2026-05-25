import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import ReportCard, { type ReportMeta } from '../components/ReportCard.tsx';

const API_URL = import.meta.env.VITE_API_URL || '';

function ReportModal({
  reportId,
  onClose,
}: {
  reportId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full h-full max-w-6xl max-h-[90vh] rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3"
          style={{
            background: 'rgba(13,15,26,0.9)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Report: <span style={{ color: 'var(--accent)' }}>{reportId.slice(0, 16)}...</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${API_URL}/api/reports/${reportId}/html`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: 'rgba(108,99,255,0.15)',
                color: 'var(--accent)',
                border: '1px solid rgba(108,99,255,0.35)',
              }}
            >
              Open in New Tab ↗
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            >
              <X size={16} color="var(--text-muted)" />
            </button>
          </div>
        </div>
        <iframe
          src={`${API_URL}/api/reports/${reportId}/html`}
          className="w-full h-full"
          style={{ border: 'none', marginTop: 0, paddingTop: '50px', height: '100%' }}
          title={`Report ${reportId}`}
        />
      </div>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { reports: ReportMeta[] };
      setReports(data.reports);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const filtered =
    filter === 'all' ? reports : reports.filter((r) => r.sentiment === filter);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'Georgia, serif', color: 'var(--text)' }}
          >
            Market Reports
          </h1>
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {reports.length} report{reports.length !== 1 ? 's' : ''} generated autonomously
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {(['all', 'bullish', 'bearish', 'neutral'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all"
                style={
                  filter === f
                    ? {
                        background: 'rgba(108,99,255,0.2)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(108,99,255,0.4)',
                      }
                    : {
                        color: 'var(--text-muted)',
                        border: '1px solid transparent',
                      }
                }
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => void fetchReports()}
            className="p-2 rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            title="Refresh"
          >
            <RefreshCw size={16} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 font-mono text-sm mb-6"
          style={{
            background: 'rgba(255,77,107,0.1)',
            border: '1px solid rgba(255,77,107,0.3)',
            color: '#ff4d6b',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-[320px] rounded-xl animate-pulse"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-4">📊</div>
          <div
            className="font-mono text-lg mb-2"
            style={{ color: 'var(--text)' }}
          >
            No reports yet
          </div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Run the agent to generate your first crypto intelligence report.
          </div>
          <div className="font-mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            <code className="px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.4)' }}>
              RUN_ONCE=true npm start
            </code>
          </div>
        </div>
      )}

      {/* Report grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((report) => (
            <ReportCard
              key={report.reportId}
              report={report}
              onOpen={setOpenReportId}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {openReportId && (
        <ReportModal
          reportId={openReportId}
          onClose={() => setOpenReportId(null)}
        />
      )}
    </div>
  );
}
