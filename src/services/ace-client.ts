import { AceDataCloud } from '@acedatacloud/sdk';
import { Keypair, Connection, Transaction } from '@solana/web3.js';
import { walletAdapter } from '../utils/solana';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import type {
  NewsItem,
  NewsSearchResult,
  LLMAnalysisResult,
  MarketNarrative,
  InsightsResult,
  GeneratedImage,
} from '../types/index';

let _aceClient: AceDataCloud | null = null;

/**
 * Create the Ace Data Cloud client.
 *
 * Priority:
 *  1. ACE_API_KEY set → API token auth (uses free credits, no USDC, no wallet)
 *  2. Neither set      → x402 USDC payments via Solana wallet
 */
export async function createAceClient(keypair: Keypair): Promise<AceDataCloud> {
  if (_aceClient) return _aceClient;

  const apiKey = (process.env.ACE_API_KEY || '').trim();
  const baseURL = process.env.ACE_BASE_URL || 'https://api.acedata.cloud';

  if (apiKey) {
    // ── API key mode — no USDC payments needed ──────────────────────────────
    _aceClient = new AceDataCloud({ apiToken: apiKey, baseURL });
    logger.info('Ace Data Cloud: API token auth (free credits mode)');
  } else {
    // ── x402 USDC mode — pays per request from Solana wallet ────────────────
    const adapter = walletAdapter(keypair);

    // x402 client needs signAndSendTransaction in addition to signTransaction
    const fullAdapter = {
      ...adapter,
      signAndSendTransaction: async (tx: Transaction): Promise<string> => {
        const { getPublicConnection, pollConfirmation } = await import('../utils/solana');
        const conn = await getPublicConnection();
        const { blockhash } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = keypair.publicKey;
        tx.sign(keypair);
        const sig = await conn.sendRawTransaction(tx.serialize(), {
          skipPreflight: true, maxRetries: 5,
        });
        await pollConfirmation(conn, sig);
        return sig;
      },
    };

    // @ts-ignore — ESM-only package, no TS declarations
    const x402Module = await eval("import('@acedatacloud/x402-client/sdk')");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createX402PaymentHandler = (x402Module as any).createX402PaymentHandler;

    const paymentHandler = createX402PaymentHandler({
      network: 'solana',
      solanaWallet: fullAdapter,
      facilitatorUrl: process.env.ACE_PAYMENT_FACILITATOR || 'https://facilitator.acedata.cloud',
    });

    _aceClient = new AceDataCloud({ paymentHandler: paymentHandler as any, baseURL });
    logger.info('Ace Data Cloud: x402 USDC payment mode');
  }

  return _aceClient;
}

// ─── Service 1: Web Search ────────────────────────────────────────────────────

export async function searchCryptoNews(
  aceClient: AceDataCloud,
  assets: string[],
): Promise<NewsSearchResult> {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const queries = [
    `Bitcoin BTC price today ${today} market update`,
    `Ethereum ETH price ${today} crypto news`,
    `${assets.slice(0, 3).join(' ')} crypto price today ${today}`,
    `${assets[0]} ${assets[1]} market analysis ${month}`,
    `crypto market news ${today} latest`,
    `Solana SOL BNB AVAX price update ${today}`,
  ];

  const allItems: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const result = await withRetry(
        () => aceClient.search.google({ query, type: 'search', page: 1 }),
        { maxAttempts: 3, initialDelayMs: 2000 },
        `ace-search: ${query.slice(0, 40)}`,
      );

      const raw = result as Record<string, unknown>;
      const items = (
        (raw.organic as unknown[]) || (raw.results as unknown[]) || []
      ) as Array<{
        title?: string; url?: string; link?: string;
        snippet?: string; description?: string; source?: string; date?: string;
      }>;

      for (const item of items) {
        const url = item.url || item.link || '';
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const title = item.title || '';
        const snippet = item.snippet || item.description || '';
        const upper = `${title} ${snippet}`.toUpperCase();
        const relevanceScore = assets.reduce(
          (s, a) => s + (upper.includes(a) ? 1 : 0), 0
        );

        allItems.push({
          title, url, snippet,
          source: item.source || (() => { try { return new URL(url).hostname; } catch { return url; } })(),
          publishedAt: item.date || new Date().toISOString(),
          relevanceScore,
        });
      }
      logger.debug(`Search "${query.slice(0, 40)}..." → ${items.length} results`);
    } catch (err) {
      logger.warn(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const top25 = allItems.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 25);
  logger.info(`Ace Web Search: ${allItems.length} total → ${top25.length} kept`);
  return { items: top25, totalResults: allItems.length, query: queries[0] };
}

// ─── Service 2: LLM Analysis (3 GPT-4o calls) ────────────────────────────────

export async function generateAnalysis(
  aceClient: AceDataCloud,
  newsItems: NewsItem[],
  assets: string[],
): Promise<{ analysis: LLMAnalysisResult; narrative: MarketNarrative; insights: InsightsResult }> {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const newsContext = newsItems
    .slice(0, 20)
    .map((n, i) => `${i + 1}. ${n.title}\n   ${n.snippet ? n.snippet.slice(0, 150) : ''} (${n.source})`)
    .join('\n\n');

  // ── LLM Call 1: Structured analysis ──────────────────────────────────────
  logger.info('Ace LLM (1/3): Sentiment analysis...');
  const analysisRes = await withRetry(
    () => aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a crypto analyst. Respond with valid JSON only — no markdown.' },
        { role: 'user', content:
          `Analyze LIVE crypto news from ${dateStr}. Use ONLY provided news — NOT your training data for prices.\n\n` +
          `Return JSON:\n{"sentiment":"bullish|bearish|neutral","sentimentScore":0.0,"keyThemes":["t1","t2","t3"],` +
          `"topStories":[{"headline":"h","impact":"i"}],"assetSentiment":{"${assets.join('":"neutral","')}":"neutral"},"marketPhase":"string"}\n\n` +
          `LIVE NEWS (${dateStr}):\n${newsContext}` },
      ],
      max_tokens: 1000,
    }),
    { maxAttempts: 3, initialDelayMs: 3000 },
    'ace-llm-analysis',
  );

  let analysis: LLMAnalysisResult;
  try {
    const raw = (analysisRes as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content || '{}';
    analysis = JSON.parse(raw.replace(/```json|```/g, '').trim()) as LLMAnalysisResult;
    if (!analysis.assetSentiment) {
      analysis.assetSentiment = Object.fromEntries(assets.map(a => [a, analysis.sentiment]));
    }
  } catch {
    analysis = {
      sentiment: 'neutral', sentimentScore: 0,
      keyThemes: ['Market monitoring', 'Price action', 'Ecosystem updates'],
      topStories: newsItems.slice(0, 3).map(n => ({ headline: n.title, impact: 'Monitoring' })),
      assetSentiment: Object.fromEntries(assets.map(a => [a, 'neutral' as const])),
      marketPhase: 'Consolidation',
    };
  }

  // ── LLM Call 2: Market narrative ──────────────────────────────────────────
  logger.info('Ace LLM (2/3): Market narrative...');
  const narrativeRes = await withRetry(
    () => aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Nexus Intel, an autonomous crypto intelligence platform.' },
        { role: 'user', content:
          `Write a comprehensive crypto market report for ${dateStr}.\n` +
          `IMPORTANT: Base ALL prices and conditions on the live news below — NOT training data.\n` +
          `Sentiment: ${analysis.sentiment} | Assets: ${assets.join(', ')}\n\n` +
          `LIVE NEWS:\n${newsItems.slice(0, 15).map(n => `• ${n.title}\n  ${n.snippet?.slice(0, 120) || ''}`).join('\n')}\n\n` +
          `Write 5 sections separated by ##:\n## Market Overview\n## Asset Analysis\n## DeFi & Ecosystem Update\n## Macro Context\n## Forward Outlook\n\n` +
          `Target: ~1500 words. Reference specific data points from the news above.` },
      ],
      max_tokens: 2000,
    }),
    { maxAttempts: 3, initialDelayMs: 3000 },
    'ace-llm-narrative',
  );

  const narrativeText = (narrativeRes as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content || 'Analysis unavailable.';
  const sections = narrativeText.split(/^## /m).filter(Boolean).map(p => {
    const lines = p.split('\n');
    return { heading: lines[0]?.trim() || 'Section', content: lines.slice(1).join('\n').trim() };
  });

  const narrative: MarketNarrative = {
    title: `Nexus Intel Market Report — ${dateStr}`,
    fullText: narrativeText,
    wordCount: narrativeText.split(/\s+/).length,
    sections,
  };

  // ── LLM Call 3: Insights ──────────────────────────────────────────────────
  logger.info('Ace LLM (3/3): Insights extraction...');
  const insightsRes = await withRetry(
    () => aceClient.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Respond with valid JSON only.' },
        { role: 'user', content:
          `Extract insights from this analysis. Return JSON:\n` +
          `{"keyInsights":["i1","i2","i3","i4","i5"],"riskFactors":["r1","r2","r3"],"opportunities":["o1","o2"],"oneLineOutlook":"string"}\n\n` +
          `Context: ${narrative.sections[0]?.content || narrativeText.slice(0, 500)}` },
      ],
      max_tokens: 800,
    }),
    { maxAttempts: 3, initialDelayMs: 3000 },
    'ace-llm-insights',
  );

  let insights: InsightsResult;
  try {
    const raw = (insightsRes as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content || '{}';
    insights = JSON.parse(raw.replace(/```json|```/g, '').trim()) as InsightsResult;
  } catch {
    insights = {
      keyInsights: ['Monitor support levels', 'Watch volume', 'DeFi TVL trends', 'Institutional flows', 'Regulatory watch'],
      riskFactors: ['Macro uncertainty', 'Liquidity conditions', 'Regulatory risk'],
      opportunities: ['Quality asset entry points', 'DeFi yield opportunities'],
      oneLineOutlook: `${analysis.sentiment} bias with selective opportunities across ${assets.slice(0, 2).join(' and ')}.`,
    };
  }

  logger.info(`LLM complete — ${analysis.sentiment}, ${narrative.wordCount} words`);
  return { analysis, narrative, insights };
}

// ─── Service 3: Image Generation ─────────────────────────────────────────────

export async function generateReportCover(
  aceClient: AceDataCloud,
  sentiment: 'bullish' | 'bearish' | 'neutral',
  assets: string[],
): Promise<GeneratedImage | null> {
  const colors = { bullish: 'emerald green and gold', bearish: 'crimson red and dark grey', neutral: 'electric blue and silver' };
  const prompt = `Professional crypto market intelligence report cover, dark cyberpunk aesthetic, ${colors[sentiment]} colors, glowing data visualizations, blockchain nodes, ${assets.slice(0, 3).join(' ')} logos, dramatic lighting, 4K`;

  try {
    logger.info('Ace Image Gen: Creating report cover...');
    const result = await withRetry(
      () => aceClient.images.generate({
        provider: 'nano-banana',
        model:    'nano-banana',
        prompt,
        wait:     true,
        maxWait:  180_000,
      }),
      { maxAttempts: 2, initialDelayMs: 5000 },
      'ace-image-gen',
    );

    const r = result as Record<string, unknown>;
    const url = String(r.url || r.imageUrl || r.image_url || r.output || '');
    if (!url) { logger.warn('Image gen returned no URL'); return null; }

    const axios = (await import('axios')).default;
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
    const base64 = Buffer.from(resp.data as ArrayBuffer).toString('base64');
    const mimeType = (resp.headers['content-type'] as string) || 'image/png';

    logger.info(`Image generated (${Math.round(base64.length / 1024)}KB)`);
    return { url, base64, mimeType, provider: 'nano-banana', prompt };
  } catch (err) {
    logger.warn(`Image gen failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
