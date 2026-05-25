import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
const MAX_LOG_LINES = 50;

export interface LogLine {
  id: number;
  line: string;
  ts: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'unknown';
}

function detectLevel(line: string): LogLine['level'] {
  const upper = line.toUpperCase();
  if (upper.includes('[ERROR]') || upper.includes('error')) return 'error';
  if (upper.includes('[WARN]') || upper.includes('warn')) return 'warn';
  if (upper.includes('[DEBUG]')) return 'debug';
  return 'info';
}

export function useLogs() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        es = new EventSource(`${API_URL}/api/logs`);

        es.onopen = () => {
          if (mounted) {
            setConnected(true);
            setError(null);
          }
        };

        es.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data) as {
              type: string;
              line?: string;
              ts: string;
            };

            if (data.type === 'log' && data.line) {
              const logLine: LogLine = {
                id: ++counterRef.current,
                line: data.line,
                ts: data.ts,
                level: detectLevel(data.line),
              };
              setLines((prev) => {
                const updated = [...prev, logLine];
                return updated.slice(-MAX_LOG_LINES);
              });
            }
          } catch {
            // Ignore parse errors
          }
        };

        es.onerror = () => {
          if (mounted) {
            setConnected(false);
            setError('Log stream disconnected. Reconnecting...');
            es?.close();
            // Reconnect after 5s
            setTimeout(() => {
              if (mounted) connect();
            }, 5000);
          }
        };
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'SSE connection failed');
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      es?.close();
    };
  }, []);

  return { lines, connected, error };
}
