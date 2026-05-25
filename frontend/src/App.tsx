import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, FileText, Link, Zap } from 'lucide-react';
import Dashboard from './pages/Dashboard.tsx';
import Reports from './pages/Reports.tsx';
import OnChain from './pages/OnChain.tsx';

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-all ${
          isActive
            ? 'bg-[rgba(108,99,255,0.2)] text-[#6c63ff] border border-[rgba(108,99,255,0.4)]'
            : 'text-[#9094b0] hover:text-[#e8eaf6] hover:bg-[rgba(255,255,255,0.04)]'
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* ── Top Nav ── */}
        <nav
          className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
          style={{
            background: 'rgba(13, 15, 26, 0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <Zap size={16} color="white" />
            </div>
            <div>
              <div className="font-mono text-base font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                NEXUS INTEL
              </div>
              <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                AUTONOMOUS CRYPTO INTELLIGENCE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NavItem to="/" icon={Activity} label="Dashboard" />
            <NavItem to="/reports" icon={FileText} label="Reports" />
            <NavItem to="/onchain" icon={Link} label="On-Chain" />
          </div>

          <div
            className="font-mono text-[10px] px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(0, 200, 150, 0.1)',
              color: '#00c896',
              border: '1px solid rgba(0, 200, 150, 0.25)',
            }}
          >
            OOBE × ACE DATA CLOUD × SOLANA
          </div>
        </nav>

        {/* ── Content ── */}
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/onchain" element={<OnChain />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
