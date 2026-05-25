import React from 'react';
import {
  CheckCircle,
  XCircle,
  Loader,
  Circle,
  SkipForward,
  Search,
  Brain,
  Image,
  FileText,
  Link,
  Shield,
  Wallet,
  Database,
  Cpu,
} from 'lucide-react';
import type { WorkflowStep } from '../hooks/useAgentData.ts';

const STEP_ICONS: React.ElementType[] = [
  Wallet,
  Search,
  Shield,
  Search,
  Brain,
  FileText,
  Cpu,
  Image,
  FileText,
  Link,
  Shield,
];

function StepIcon({ status, IconComp }: { status: WorkflowStep['status']; IconComp: React.ElementType }) {
  if (status === 'success')
    return <CheckCircle size={16} color="#00c896" />;
  if (status === 'failed')
    return <XCircle size={16} color="#ff4d6b" />;
  if (status === 'running')
    return <Loader size={16} color="#6c63ff" className="animate-spin" />;
  if (status === 'skipped')
    return <SkipForward size={16} color="#9094b0" />;
  return <IconComp size={16} color="#9094b0" />;
}

interface Props {
  steps: WorkflowStep[];
  cycleNumber: number;
}

export default function CycleTimeline({ steps, cycleNumber }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
          Cycle #{cycleNumber} — Workflow Progress
        </div>
        <div className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>
          {steps.filter((s) => s.status === 'success').length}/{steps.length} steps
        </div>
      </div>

      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const Icon = STEP_ICONS[idx] || Database;
          const isLast = idx === steps.length - 1;

          const stepColor = {
            success: '#00c896',
            failed: '#ff4d6b',
            running: '#6c63ff',
            pending: '#9094b0',
            skipped: '#4a5568',
          }[step.status];

          return (
            <div key={step.stepId} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border"
                  style={{
                    borderColor: stepColor,
                    background:
                      step.status === 'running'
                        ? 'rgba(108,99,255,0.15)'
                        : step.status === 'success'
                        ? 'rgba(0,200,150,0.1)'
                        : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <StepIcon status={step.status} IconComp={Icon} />
                </div>
                <div
                  className="text-[9px] font-mono mt-1.5 text-center leading-tight px-1"
                  style={{
                    color: step.status === 'pending' ? 'var(--text-muted)' : stepColor,
                  }}
                >
                  {step.name.slice(0, 12)}
                </div>
                {step.durationMs && (
                  <div className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {step.durationMs < 1000
                      ? `${step.durationMs}ms`
                      : `${(step.durationMs / 1000).toFixed(1)}s`}
                  </div>
                )}
                {step.error && (
                  <div
                    className="text-[8px] font-mono text-center px-0.5 mt-0.5 max-w-[78px] truncate"
                    style={{ color: '#ff4d6b' }}
                    title={step.error}
                  >
                    {step.error.slice(0, 20)}
                  </div>
                )}
              </div>

              {!isLast && (
                <div
                  className="h-[1px] w-4 flex-shrink-0 mb-5"
                  style={{
                    background:
                      step.status === 'success'
                        ? 'var(--green)'
                        : 'var(--border)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
