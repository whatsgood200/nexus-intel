import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AgentStatus {
  isRunning: boolean;
  currentCycle: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  usdcBalance: number;
  solBalance: number;
  totalUSDCSpent: number;
  agentAddress: string;
  registration: {
    agentId: string;
    pdaAddress: string;
    txSignature: string;
    name: string;
    registeredAt: string;
  } | null;
  currentRun: WorkflowRun | null;
}

export interface WorkflowStep {
  stepId: number;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface WorkflowRun {
  runId: string;
  cycleNumber: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  steps: WorkflowStep[];
  reportId: string | null;
  onChainTx: string | null;
  totalUSDC: number;
  wordCount: number;
  assets: string[];
  error: string | null;
}

export function useAgentData() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AgentStatus;
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/runs?limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: WorkflowRun[] };
      setRuns(data.runs);
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchStatus(), fetchRuns()]);
      if (mounted) setIsLoading(false);
    };

    void loadAll();

    const interval = setInterval(() => {
      if (mounted) {
        void fetchStatus();
        void fetchRuns();
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchStatus, fetchRuns]);

  return { status, runs, isLoading, error, refresh: fetchStatus };
}
