// ─── Agent Registration ───────────────────────────────────────────────────────

export interface AgentCapability {
  id: string;
  description: string;
  protocolId: string;
  version: string;
}

export interface AgentRegistration {
  agentId: string;
  pdaAddress: string;
  txSignature: string;
  name: string;
  description: string;
  registeredAt: string;
  network: 'mainnet' | 'testnet';
}

// ─── Workflow Step Tracking ───────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface WorkflowStep {
  stepId: number;
  name: string;
  status: StepStatus;
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

// ─── Ace Data Cloud Results ───────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string;
  relevanceScore: number;
}

export interface NewsSearchResult {
  items: NewsItem[];
  totalResults: number;
  query: string;
}

export interface LLMAnalysisResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number; // -1.0 to 1.0
  keyThemes: string[];
  topStories: Array<{ headline: string; impact: string }>;
  assetSentiment: Record<string, 'bullish' | 'bearish' | 'neutral'>;
  marketPhase: string;
}

export interface MarketNarrative {
  title: string;
  fullText: string;
  wordCount: number;
  sections: Array<{ heading: string; content: string }>;
}

export interface InsightsResult {
  keyInsights: string[];
  riskFactors: string[];
  opportunities: string[];
  oneLineOutlook: string;
}

export interface GeneratedImage {
  url: string;
  base64: string;
  mimeType: string;
  provider: string;
  prompt: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ReportMetadata {
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
  jsonPath: string;
  coverImageB64: string | null;
  onChainTx: string | null;
}

export interface ReportData {
  metadata: ReportMetadata;
  newsItems: NewsItem[];
  analysis: LLMAnalysisResult;
  narrative: MarketNarrative;
  insights: InsightsResult;
  coverImage: GeneratedImage | null;
  sapDiscovery: SAPDiscoveryResult;
  sentinelStatus: SentinelStatus;
}

// ─── SAP Discovery ────────────────────────────────────────────────────────────

export interface SAPDiscoveryResult {
  networkOverview: {
    totalAgents: number;
    activeAgents: number;
    toolsCount: number;
  };
  aceAgents: Array<{
    name: string;
    address: string;
    protocol: string;
    capabilities: string[];
  }>;
  dataTools: Array<{
    name: string;
    category: string;
    description: string;
  }>;
  discoveredAt: string;
}

// ─── Sentinel ─────────────────────────────────────────────────────────────────

export interface SentinelStatus {
  address: string;
  name: string;
  active: boolean;
  reputation: number;
  lastVerifiedAt: string;
  proofHash: string | null;
}

// ─── On-chain Memo ────────────────────────────────────────────────────────────

export interface OnChainMemo {
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

export interface OnChainRecord {
  txSignature: string;
  memo: OnChainMemo;
  solscanUrl: string;
  confirmedAt: string;
}

// ─── Stored run log ───────────────────────────────────────────────────────────

export interface RunLog {
  totalCycles: number;
  totalUSDC: number;
  lastRunAt: string | null;
  runs: WorkflowRun[];
  onChainRecords: OnChainRecord[];
}

// ─── Agent Status (API) ───────────────────────────────────────────────────────

export interface AgentStatusResponse {
  isRunning: boolean;
  currentCycle: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  usdcBalance: number;
  solBalance: number;
  totalUSDCSpent: number;
  agentAddress: string;
  registration: AgentRegistration | null;
  currentRun: WorkflowRun | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  solanaPrivateKey: string;
  synapseRpcApiKey: string;
  synapseRpcUrl: string;
  aceApiKey: string;
  aceBaseUrl: string;
  acePaymentFacilitator: string;
  sapAgentName: string;
  sapAgentDescription: string;
  sentinelAddress: string;
  agentCronSchedule: string;
  trackedAssets: string[];
  maxRetries: number;
  reportsDir: string;
  apiPort: number;
  logLevel: string;
  logToFile: boolean;
}
