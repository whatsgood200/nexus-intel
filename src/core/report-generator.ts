import type {
  ReportData,
  LLMAnalysisResult,
  MarketNarrative,
  InsightsResult,
  NewsItem,
  GeneratedImage,
  SAPDiscoveryResult,
  SentinelStatus,
} from '../types/index';

export function generateHTMLReport(data: ReportData): string {
  const {
    metadata,
    newsItems,
    analysis,
    narrative,
    insights,
    coverImage,
    sapDiscovery,
    sentinelStatus,
  } = data;

  const sentimentColor = {
    bullish: '#00c896',
    bearish: '#ff4d6b',
    neutral: '#f59e0b',
  }[analysis.sentiment];

  const sentimentEmoji = {
    bullish: '📈',
    bearish: '📉',
    neutral: '➡️',
  }[analysis.sentiment];

  const coverImageTag = coverImage
    ? `<img src="data:${coverImage.mimeType};base64,${coverImage.base64}" alt="Report Cover" class="cover-image" />`
    : `<div class="cover-placeholder">
        <div class="cover-placeholder-inner">
          <span class="cover-icon">⚡</span>
          <span class="cover-label">NEXUS INTEL</span>
        </div>
      </div>`;

  const sectionsHTML = narrative.sections
    .map(
      (s) => `
      <div class="section">
        <h2 class="section-heading">${escapeHtml(s.heading)}</h2>
        <div class="section-content">${escapeHtml(s.content)
          .split('\n\n')
          .map((p) => `<p>${p}</p>`)
          .join('')}</div>
      </div>`
    )
    .join('');

  const topNewsHTML = newsItems
    .slice(0, 10)
    .map(
      (n) => `
      <li class="news-item">
        <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener" class="news-link">
          ${escapeHtml(n.title)}
        </a>
        <span class="news-source">${escapeHtml(n.source)}</span>
      </li>`
    )
    .join('');

  const insightsHTML = insights.keyInsights
    .map((i) => `<li class="insight-item">💡 ${escapeHtml(i)}</li>`)
    .join('');

  const risksHTML = insights.riskFactors
    .map((r) => `<li class="risk-item">⚠️ ${escapeHtml(r)}</li>`)
    .join('');

  const opportunitiesHTML = insights.opportunities
    .map((o) => `<li class="opp-item">🎯 ${escapeHtml(o)}</li>`)
    .join('');

  const assetSentimentHTML = Object.entries(analysis.assetSentiment ?? {})
    .map(([asset, sent]) => {
      const color = { bullish: '#00c896', bearish: '#ff4d6b', neutral: '#f59e0b' }[sent];
      const arrow = { bullish: '▲', bearish: '▼', neutral: '▶' }[sent];
      return `<div class="asset-badge" style="border-color:${color}">
        <span class="asset-name">${escapeHtml(asset)}</span>
        <span class="asset-sentiment" style="color:${color}">${arrow} ${sent.toUpperCase()}</span>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(narrative.title)}</title>
  <style>
    :root {
      --bg: #0d0f1a;
      --surface: #151828;
      --surface-2: #1c2035;
      --border: rgba(120, 130, 200, 0.15);
      --accent: #6c63ff;
      --green: #00c896;
      --red: #ff4d6b;
      --amber: #f59e0b;
      --text: #e8eaf6;
      --text-muted: #9094b0;
      --sentiment: ${sentimentColor};
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.7;
      font-size: 16px;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, var(--surface) 0%, #0a0c18 100%);
      border-bottom: 1px solid var(--border);
      padding: 0;
      overflow: hidden;
    }

    .cover-image {
      width: 100%;
      max-height: 360px;
      object-fit: cover;
      display: block;
      opacity: 0.9;
    }

    .cover-placeholder {
      width: 100%;
      height: 280px;
      background: linear-gradient(135deg, #0d0f1a 0%, #1a1040 50%, #0d0f1a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cover-placeholder-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .cover-icon {
      font-size: 64px;
      filter: drop-shadow(0 0 20px var(--accent));
    }

    .cover-label {
      font-family: 'Courier New', monospace;
      font-size: 28px;
      letter-spacing: 8px;
      color: var(--accent);
      text-shadow: 0 0 20px var(--accent);
    }

    .header-content {
      padding: 24px 40px;
      border-top: 3px solid var(--sentiment);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 40px;
      height: 40px;
      background: var(--accent);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .brand-text h1 {
      font-family: 'Courier New', monospace;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 3px;
      color: var(--accent);
    }

    .brand-text p {
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 1px;
    }

    .report-meta {
      text-align: right;
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.8;
    }

    .report-meta strong {
      color: var(--text);
    }

    .report-title {
      margin-top: 20px;
    }

    .report-title h2 {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
    }

    .sentiment-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--sentiment);
      color: var(--sentiment);
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      margin-top: 10px;
      font-family: 'Courier New', monospace;
    }

    .outlook-text {
      margin-top: 12px;
      font-style: italic;
      color: var(--text-muted);
      font-size: 15px;
    }

    /* ── Main Layout ── */
    .main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px;
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 32px;
    }

    /* ── Article ── */
    .article {}

    .section {
      margin-bottom: 36px;
    }

    .section-heading {
      font-size: 20px;
      font-weight: 700;
      color: var(--accent);
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      border-left: 3px solid var(--accent);
      padding-left: 14px;
      margin-bottom: 16px;
    }

    .section-content p {
      margin-bottom: 16px;
      color: var(--text);
      font-size: 15.5px;
    }

    /* ── Sidebar ── */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }

    .card-title {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }

    /* Asset sentiment badges */
    .asset-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .asset-badge {
      flex: 1;
      min-width: 80px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
    }

    .asset-name {
      display: block;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }

    .asset-sentiment {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }

    /* Insights list */
    .insight-item, .risk-item, .opp-item {
      font-size: 13.5px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      line-height: 1.5;
      color: var(--text);
    }

    .insight-item:last-child, .risk-item:last-child, .opp-item:last-child {
      border-bottom: none;
    }

    /* News list */
    .news-item {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .news-item:last-child { border-bottom: none; }

    .news-link {
      font-size: 13px;
      color: var(--text);
      line-height: 1.4;
    }

    .news-link:hover { color: var(--accent); }

    .news-source {
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'Courier New', monospace;
    }

    /* Score bar */
    .score-bar-wrap {
      background: var(--surface-2);
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0 4px;
    }

    .score-bar {
      height: 100%;
      background: var(--sentiment);
      border-radius: 4px;
      transition: width 1s ease;
    }

    .score-label {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'Courier New', monospace;
    }

    /* Footer */
    .footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 24px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
    }

    .footer-brand {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 1px;
    }

    .footer-chain {
      text-align: right;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.8;
    }

    .footer-chain a {
      color: var(--accent);
      font-size: 11px;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 24px 0;
    }

    ul { list-style: none; padding: 0; }

    @media (max-width: 900px) {
      .main { grid-template-columns: 1fr; padding: 20px; }
      .header-content { padding: 20px; }
      .header-top { flex-direction: column; }
      .report-meta { text-align: left; }
    }
  </style>
</head>
<body>

<header class="header">
  ${coverImageTag}
  <div class="header-content">
    <div class="header-top">
      <div class="brand">
        <div class="brand-logo">⚡</div>
        <div class="brand-text">
          <h1>NEXUS INTEL</h1>
          <p>AUTONOMOUS CRYPTO INTELLIGENCE</p>
        </div>
      </div>
      <div class="report-meta">
        <strong>Cycle #${metadata.cycleNumber}</strong><br>
        ${new Date(metadata.createdAt).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        })}<br>
        Tracking: <strong>${metadata.assets.join(', ')}</strong><br>
        <span style="color:#6c63ff">Powered by Ace Data Cloud × OOBE Protocol</span>
      </div>
    </div>

    <div class="report-title">
      <h2>${escapeHtml(narrative.title)}</h2>
      <span class="sentiment-badge">${sentimentEmoji} ${analysis.sentiment.toUpperCase()} MARKET</span>
      <p class="outlook-text">${escapeHtml(insights.oneLineOutlook)}</p>
    </div>
  </div>
</header>

<main class="main">
  <article class="article">
    ${sectionsHTML || `<div class="section"><p>${escapeHtml(narrative.fullText)}</p></div>`}
  </article>

  <aside class="sidebar">

    <!-- Market Sentiment Score -->
    <div class="card">
      <div class="card-title">📊 Market Sentiment Score</div>
      <div class="score-bar-wrap">
        <div class="score-bar" style="width: ${Math.abs(analysis.sentimentScore) * 100}%"></div>
      </div>
      <div class="score-label">
        <span>BEARISH</span>
        <span style="color:var(--sentiment);font-weight:700">
          ${analysis.sentimentScore > 0 ? '+' : ''}${(analysis.sentimentScore * 100).toFixed(0)}
        </span>
        <span>BULLISH</span>
      </div>
      <div style="margin-top:12px;font-size:13px;color:var(--text-muted)">
        ${escapeHtml(analysis.marketPhase)}
      </div>
    </div>

    <!-- Asset Sentiment -->
    <div class="card">
      <div class="card-title">🎯 Asset Sentiment</div>
      <div class="asset-grid">${assetSentimentHTML}</div>
    </div>

    <!-- Key Insights -->
    <div class="card">
      <div class="card-title">💡 Key Insights</div>
      <ul>${insightsHTML}</ul>
    </div>

    <!-- Risk Factors -->
    <div class="card">
      <div class="card-title">⚠️ Risk Factors</div>
      <ul>${risksHTML}</ul>
    </div>

    <!-- Opportunities -->
    <div class="card">
      <div class="card-title">🎯 Opportunities</div>
      <ul>${opportunitiesHTML}</ul>
    </div>

    <!-- Key Themes -->
    <div class="card">
      <div class="card-title">🔑 Key Themes</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
        ${analysis.keyThemes
          .map(
            (t) =>
              `<span style="background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.4);border-radius:4px;padding:4px 10px;font-size:12px;color:#a0a6d2">${escapeHtml(t)}</span>`
          )
          .join('')}
      </div>
    </div>

    <!-- News Sources -->
    <div class="card">
      <div class="card-title">📰 Top News Sources</div>
      <ul>${topNewsHTML}</ul>
    </div>

    <!-- SAP Discovery -->
    <div class="card">
      <div class="card-title">🔗 SAP Network</div>
      <div style="font-size:13px;color:var(--text-muted);line-height:2">
        <div>Total Agents: <strong style="color:var(--text)">${sapDiscovery.networkOverview.totalAgents}</strong></div>
        <div>Active Agents: <strong style="color:var(--green)">${sapDiscovery.networkOverview.activeAgents}</strong></div>
        <div>Tools: <strong style="color:var(--text)">${sapDiscovery.networkOverview.toolsCount}</strong></div>
        <div>Ace Agents Found: <strong style="color:var(--accent)">${sapDiscovery.aceAgents.length}</strong></div>
      </div>
    </div>

    <!-- Sentinel Status -->
    <div class="card">
      <div class="card-title">🛡️ Sentinel Verification</div>
      <div style="font-size:13px;color:var(--text-muted);line-height:2">
        <div>Status: <strong style="color:${sentinelStatus.active ? 'var(--green)' : 'var(--amber)'}">
          ${sentinelStatus.active ? '✓ ACTIVE' : '⚠ CHECKING'}
        </strong></div>
        <div>Reputation: <strong style="color:var(--text)">${sentinelStatus.reputation}</strong></div>
        <div style="word-break:break-all;margin-top:6px;font-size:10px;font-family:'Courier New',monospace;color:#6c63ff">
          ${escapeHtml(sentinelStatus.address)}
        </div>
      </div>
    </div>

  </aside>
</main>

<footer class="footer">
  <div class="footer-brand">
    ⚡ NEXUS INTEL — Autonomous Crypto Intelligence<br>
    <span style="opacity:0.5">Powered by OOBE Protocol SAP × Ace Data Cloud × Solana</span>
  </div>
  <div class="footer-chain">
    Report ID: <code style="color:var(--accent)">${metadata.reportId}</code><br>
    Run ID: <code style="color:var(--text-muted)">${metadata.runId}</code><br>
    ${metadata.onChainTx
      ? `On-chain: <a href="https://solscan.io/tx/${metadata.onChainTx}" target="_blank">View on Solscan ↗</a>`
      : 'On-chain verification pending'}
  </div>
</footer>

</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
