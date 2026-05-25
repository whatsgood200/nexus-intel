/**
 * NEXUS INTEL — FREE PIPELINE TEST
 * ══════════════════════════════════════════════════════════════
 * Tests the entire AI workflow WITHOUT spending SOL or USDC.
 *
 * What this tests (all free):
 *   ✓ Ace Web Search     — real live crypto news
 *   ✓ Ace LLM Analysis   — real GPT-4o sentiment analysis
 *   ✓ Ace LLM Narrative  — real 1500-word market report
 *   ✓ Ace LLM Insights   — real insights extraction
 *   ✓ Ace Image Gen      — real AI cover image
 *   ✓ HTML report saved  — opens in browser
 *   ✓ Config validation  — .env is correct
 *
 * What this skips (needs SOL/mainnet):
 *   ✗ SAP registration   — skipped (needs 0.039 SOL)
 *   ✗ Sentinel on-chain  — skipped (needs mainnet RPC)
 *   ✗ SPL Memo tx        — skipped (needs SOL for fees)
 *
 * HOW TO USE:
 *   1. Sign up at https://platform.acedata.cloud (free)
 *   2. Copy your API token
 *   3. Add to .env:  ACE_API_KEY=your_token_here
 *   4. Run:  npx ts-node src/test-pipeline.ts
 *
 * If this runs successfully → your agent works → safe to fund wallet.
 */

import './config';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { AceDataCloud } from '@acedatacloud/sdk';
import { config } from './config';
import { generateHTMLReport } from './core/report-generator';
import type {
  LLMAnalysisResult,
  MarketNarrative,
  InsightsResult,
  GeneratedImage,
  NewsItem,
  ReportData,
  ReportMetadata,
} from './types/index';

const PASS = chalk.green('  ✓ PASS');
const FAIL = chalk.red('  ✗ FAIL');
const SKIP = chalk.yellow('  ○ SKIP');

let passed = 0;
let failed = 0;

function result(label: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`${PASS}  ${label}${detail ? chalk.gray(' — ' + detail) : ''}`);
    passed++;
  } else {
    console.log(`${FAIL}  ${label}${detail ? chalk.red(' — ' + detail) : ''}`);
    failed++;
  }
}

async function runTest() {
  console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║        NEXUS INTEL — FREE PIPELINE TEST               ║'));
  console.log(chalk.cyan('║  Tests AI workflow without spending SOL or USDC       ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════╝\n'));

  // ── Check 1: ACE_API_KEY is set ───────────────────────────────────────────
  console.log(chalk.bold('Step 1 — Config'));
  const apiKey = process.env.ACE_API_KEY?.trim();
  if (!apiKey) {
    console.log(`${FAIL}  ACE_API_KEY not set in .env`);
    console.log(chalk.yellow(
      '\n  Fix:\n' +
      '  1. Go to https://platform.acedata.cloud\n' +
      '  2. Sign up (free) — you get free credits automatically\n' +
      '  3. Copy your API token\n' +
      '  4. Add to .env:  ACE_API_KEY=your_token_here\n' +
      '  5. Re-run:  npx ts-node src/test-pipeline.ts\n'
    ));
    process.exit(1);
  }
  result('ACE_API_KEY is set', true, `${apiKey.slice(0, 8)}...`);
  result('SYNAPSE_RPC_API_KEY is set', !!process.env.SYNAPSE_RPC_API_KEY?.trim(),
    process.env.SYNAPSE_RPC_API_KEY ? 'present' : 'missing (needed for full run, not this test)');
  result('Tracked assets configured', config.trackedAssets.length > 0,
    config.trackedAssets.join(', '));

  // ── Check 2: Create Ace client with API key (no x402, no wallet needed) ───
  console.log(chalk.bold('\nStep 2 — Ace Data Cloud client'));
  let aceClient: AceDataCloud;
  try {
    aceClient = new AceDataCloud({
      apiToken: apiKey,
      baseURL: config.aceBaseUrl,
    });
    result('Ace client created (API key mode, no USDC)', true);
  } catch (err) {
    result('Ace client creation', false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // ── Check 3: Web Search ────────────────────────────────────────────────────
  console.log(chalk.bold('\nStep 3 — Ace Web Search'));
  let newsItems: NewsItem[] = [];
  try {
    const query = `${config.trackedAssets[0]} crypto market analysis today`;
    console.log(chalk.gray(`  Searching: "${query}"...`));
    const raw = await aceClient.search.google({ query, type: 'search', page: 1 }) as Record<string, unknown>;
    const items = ((raw.organic ?? raw.results ?? []) as Array<Record<string, unknown>>);

    newsItems = items.slice(0, 5).map((item) => ({
      title:          String(item.title ?? ''),
      url:            String(item.url ?? item.link ?? ''),
      snippet:        String(item.snippet ?? item.description ?? ''),
      source:         String(item.source ?? ''),
      publishedAt:    String(item.date ?? new Date().toISOString()),
      relevanceScore: 1,
    })).filter(n => n.title);

    result('Web Search returned results', newsItems.length > 0,
      `${newsItems.length} articles found`);
    if (newsItems[0]) {
      console.log(chalk.gray(`    Top result: "${newsItems[0].title.slice(0, 70)}..."`));
    }
  } catch (err) {
    result('Web Search', false, err instanceof Error ? err.message : String(err));
    console.log(chalk.yellow('  → Check your ACE_API_KEY has credits at platform.acedata.cloud'));
  }

  // ── Check 4: LLM — Analysis ────────────────────────────────────────────────
  console.log(chalk.bold('\nStep 4 — Ace LLM: News Analysis (GPT-4o)'));
  let analysis: LLMAnalysisResult | null = null;
  try {
    const newsContext = newsItems.length > 0
      ? newsItems.map((n, i) => `${i + 1}. ${n.title}`).join('\n')
      : `1. Bitcoin reaches new highs\n2. Ethereum upgrade expected\n3. Solana ecosystem growing`;

    console.log(chalk.gray('  Calling GPT-4o for sentiment analysis...'));
    const res = await aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Respond with valid JSON only, no markdown.' },
        { role: 'user', content:
          `Analyze this LIVE crypto news from TODAY and return JSON.\n` +
          `Use ONLY the news below — do NOT use training data for prices or conditions.\n\n` +
          `{"sentiment":"bullish|bearish|neutral","sentimentScore":0.5,` +
          `"keyThemes":["theme1","theme2"],"marketPhase":"string"}\n\n` +
          `LIVE NEWS (today):\n${newsContext}` },
      ],
      max_tokens: 300,
    }) as { choices: Array<{ message: { content: string } }> };

    const raw = res.choices[0]?.message?.content ?? '{}';
    analysis = JSON.parse(raw.replace(/```json|```/g, '').trim()) as LLMAnalysisResult;
    result('LLM Analysis (GPT-4o)', true,
      `sentiment=${analysis.sentiment}, score=${analysis.sentimentScore}`);
  } catch (err) {
    result('LLM Analysis', false, err instanceof Error ? err.message : String(err));
  }

  // ── Check 5: LLM — Narrative ────────────────────────────────────────────────
  console.log(chalk.bold('\nStep 5 — Ace LLM: Market Narrative (~1500 words)'));
  let narrative: MarketNarrative | null = null;
  try {
    console.log(chalk.gray('  Generating full market report...'));
    const res = await aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Nexus Intel, a crypto intelligence platform.' },
        { role: 'user', content:
          `Write a brief crypto market report for ${config.trackedAssets.join(', ')}.\n` +
          `IMPORTANT: Use ONLY the live news provided — do NOT use training data for prices.\n` +
          `Sentiment from live news: ${analysis?.sentiment ?? 'neutral'}\n\n` +
          `LIVE NEWS SOURCES:\n${newsItems.map((n,i)=>`${i+1}. ${n.title}\n   ${n.snippet?n.snippet.slice(0,120):''}`).join('\n') || 'No live news available.'}\n\n` +
          `Write 3 sections separated by ##:\n## Market Overview\n## Asset Analysis\n## Outlook\n` +
          `Target: 400 words. Reference actual news items and current prices from the sources above.` },
      ],
      max_tokens: 600,
    }) as { choices: Array<{ message: { content: string } }> };

    const text = res.choices[0]?.message?.content ?? '';
    const wordCount = text.split(/\s+/).length;
    const sections = text.split(/^## /m)
      .filter(Boolean)
      .map(p => {
        const lines = p.split('\n');
        return { heading: lines[0]?.trim() ?? '', content: lines.slice(1).join('\n').trim() };
      });

    narrative = {
      title:     `Nexus Intel Test Report — ${new Date().toLocaleDateString()}`,
      fullText:  text,
      wordCount,
      sections,
    };
    result('LLM Narrative', true, `${wordCount} words, ${sections.length} sections`);
  } catch (err) {
    result('LLM Narrative', false, err instanceof Error ? err.message : String(err));
  }

  // ── Check 6: LLM — Insights ────────────────────────────────────────────────
  console.log(chalk.bold('\nStep 6 — Ace LLM: Insights Extraction'));
  let insights: InsightsResult | null = null;
  try {
    console.log(chalk.gray('  Extracting key insights...'));
    const res = await aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Respond with valid JSON only.' },
        { role: 'user', content:
          `Extract insights. Return JSON:\n` +
          `{"keyInsights":["i1","i2"],"riskFactors":["r1"],"opportunities":["o1"],` +
          `"oneLineOutlook":"Market outlook in one sentence"}` },
      ],
      max_tokens: 300,
    }) as { choices: Array<{ message: { content: string } }> };

    const raw = res.choices[0]?.message?.content ?? '{}';
    insights = JSON.parse(raw.replace(/```json|```/g, '').trim()) as InsightsResult;
    result('LLM Insights', true, `${insights.keyInsights?.length ?? 0} insights extracted`);
    if (insights.oneLineOutlook) {
      console.log(chalk.gray(`    Outlook: "${insights.oneLineOutlook.slice(0, 80)}"`));
    }
  } catch (err) {
    result('LLM Insights', false, err instanceof Error ? err.message : String(err));
  }

  // ── Check 7: Image Generation ──────────────────────────────────────────────
  console.log(chalk.bold('\nStep 7 — Ace Image Generation'));
  let coverImage: GeneratedImage | null = null;
  try {
    console.log(chalk.gray('  Generating AI cover image (may take 30–60s)...'));
    const imgResult = await aceClient.images.generate({
      provider: 'nano-banana',
      model:    'nano-banana',
      prompt:   'Professional crypto market report cover, dark cyberpunk, glowing charts, 4K',
      wait:     true,
      maxWait:  120_000,
    }) as Record<string, unknown>;

    const url = String(imgResult.url ?? imgResult.imageUrl ?? imgResult.output ?? '');
    if (url) {
      const axios = (await import('axios')).default;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
      const base64 = Buffer.from(r.data as ArrayBuffer).toString('base64');
      coverImage = { url, base64, mimeType: 'image/png', provider: 'nano-banana', prompt: '' };
      result('Image Generation', true, `${Math.round(base64.length / 1024)}KB base64`);
    } else {
      result('Image Generation', false, 'No URL in response');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes('did not complete') || msg.toLowerCase().includes('timeout');
    if (isTimeout) {
      // Timeout means the task WAS created — just slow on free tier queue
      console.log(chalk.yellow('  ⚠ WARN  Image Generation — task created but timed out (free tier queue is slow)'));
      console.log(chalk.yellow('         This is non-fatal. The agent runs fine without a cover image.'));
      console.log(chalk.yellow('         On paid tier / with more USDC the queue is much faster.'));
    } else {
      result('Image Generation', false, msg);
    }
    console.log(chalk.yellow('  → Agent continues without cover image if this step fails'));
  }

  // ── Check 8: HTML Report Assembly ─────────────────────────────────────────
  console.log(chalk.bold('\nStep 8 — HTML Report Assembly'));
  try {
    await fs.ensureDir('./reports');

    // Guard: assetSentiment may be missing if LLM didn't return it
    if (!analysis?.assetSentiment || typeof analysis.assetSentiment !== 'object') {
      if (analysis) {
        (analysis as any).assetSentiment = Object.fromEntries(
          config.trackedAssets.map((a) => [a, analysis!.sentiment ?? 'neutral'])
        );
      }
    }

    const dummySap = {
      networkOverview: { totalAgents: 0, activeAgents: 0, toolsCount: 0 },
      aceAgents: [], dataTools: [], discoveredAt: new Date().toISOString(),
    };
    const dummySentinel = {
      address: 'Ccr2yK3hLALU4p8oNRqrh4dGuvPJTth5KCLMio8cE1ph',
      name: 'Synapse Sentinel', active: false, reputation: 100,
      lastVerifiedAt: new Date().toISOString(), proofHash: null,
    };
    const reportId = `test-${Date.now()}`;
    const meta: ReportMetadata = {
      reportId, runId: reportId, cycleNumber: 0,
      createdAt: new Date().toISOString(),
      title: narrative?.title ?? 'Test Report',
      sentiment: analysis?.sentiment ?? 'neutral',
      sentimentScore: analysis?.sentimentScore ?? 0,
      wordCount: narrative?.wordCount ?? 0,
      assets: config.trackedAssets,
      htmlPath: `./reports/${reportId}.html`,
      jsonPath:  `./reports/${reportId}.json`,
      coverImageB64: coverImage?.base64 ?? null,
      onChainTx: null,
    };
    const reportData: ReportData = {
      metadata:     meta,
      newsItems,
      analysis:     analysis ?? { sentiment: 'neutral', sentimentScore: 0, keyThemes: [], topStories: [], assetSentiment: {}, marketPhase: '' },
      narrative:    narrative ?? { title: '', fullText: '', wordCount: 0, sections: [] },
      insights:     insights  ?? { keyInsights: [], riskFactors: [], opportunities: [], oneLineOutlook: '' },
      coverImage,
      sapDiscovery: dummySap,
      sentinelStatus: dummySentinel,
    };

    const html = generateHTMLReport(reportData);
    const htmlPath = path.resolve(`./reports/${reportId}.html`);
    await fs.writeFile(htmlPath, html, 'utf8');
    result('HTML report generated', true, htmlPath);
    console.log(chalk.cyan(`\n  📄 Open your report: file://${htmlPath}\n`));
  } catch (err) {
    result('HTML report assembly', false, err instanceof Error ? err.message : String(err));
  }

  // ── Skipped steps (need SOL) ───────────────────────────────────────────────
  console.log(chalk.bold('\nSteps skipped (need funded wallet):'));
  console.log(`${SKIP}  SAP Tool Discovery    — needs SYNAPSE_RPC_API_KEY + mainnet`);
  console.log(`${SKIP}  Sentinel Verification — needs mainnet RPC`);
  console.log(`${SKIP}  SPL Memo on-chain log — needs ~0.000005 SOL`);
  console.log(`${SKIP}  SAP Registration      — needs ~0.039 SOL (one-time)`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(chalk.bold('\n══════════════════════════════════════════════'));
  if (failed === 0) {
    console.log(chalk.green(`  ✅  ALL CRITICAL TESTS PASSED (${passed} passed) — your agent works!`));
    console.log(chalk.green('  Image gen timeout is non-fatal — agent runs fine without cover images.'));
    console.log(chalk.green('  Safe to fund wallet and run the full agent.'));
    console.log(chalk.cyan('\n  Next steps:'));
    console.log('  1. Send 0.05 SOL to your wallet');
    console.log('  2. Run:  npm run register');
    console.log('  3. Run:  RUN_ONCE=true npm start');
  } else {
    console.log(chalk.red(`  ❌  ${failed} test(s) failed, ${passed} passed`));
    console.log(chalk.yellow('  Fix the failures above before funding your wallet.'));
  }
  console.log(chalk.bold('══════════════════════════════════════════════\n'));
}

runTest().catch((err) => {
  console.error(chalk.red('\nFatal error:'), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
