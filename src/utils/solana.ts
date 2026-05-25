import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import { logger } from './logger';

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export const USDC_MINT       = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDC_DECIMALS   = 6;

// Public mainnet RPCs for sending transactions
// The Synapse RPC handles Anchor program calls but rejects standard
// Solana JSON-RPC methods and WebSocket upgrades
const PUBLIC_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

let _keypair: Keypair | null = null;
let _connection: Connection | null = null;

export function loadKeypair(base58PrivateKey: string): Keypair {
  if (_keypair) return _keypair;
  try {
    _keypair = Keypair.fromSecretKey(bs58.decode(base58PrivateKey));
    logger.debug(`Wallet loaded: ${_keypair.publicKey.toBase58()}`);
    return _keypair;
  } catch (err) {
    throw new Error(
      `Failed to load keypair from SOLANA_PRIVATE_KEY: ${err instanceof Error ? err.message : String(err)}\n` +
      `Make sure it is a base58 private key, not a JSON array.`
    );
  }
}

export function getConnection(rpcUrl?: string): Connection {
  if (_connection) return _connection;
  const url = rpcUrl || PUBLIC_RPCS[0];
  _connection = new Connection(url, { commitment: 'confirmed' });
  return _connection;
}

/**
 * Get a working connection for sending transactions.
 * Tries public mainnet RPCs in order — no WebSocket, no API key needed.
 */
export async function getPublicConnection(): Promise<Connection> {
  for (const rpc of PUBLIC_RPCS) {
    try {
      const conn = new Connection(rpc, { commitment: 'confirmed' });
      await conn.getLatestBlockhash('confirmed'); // test it works
      return conn;
    } catch {
      logger.debug(`RPC ${rpc} unreachable, trying next...`);
    }
  }
  throw new Error('All public RPC endpoints failed. Check internet connection.');
}

/**
 * Poll for transaction confirmation — pure HTTP, no WebSocket.
 * Solana's confirmTransaction() uses WebSocket internally and fails on
 * Synapse RPC with "ws error: 400". This avoids WebSockets entirely.
 */
export async function pollConfirmation(
  connection: Connection,
  signature: string,
  timeoutMs = 90_000,
  intervalMs = 3_500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const s = value[0];
      if (s?.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}`);
      }
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') {
        logger.debug(`TX confirmed (${s.confirmationStatus}) after ~${Math.round(attempt * intervalMs / 1000)}s`);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('failed on-chain')) throw err;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  logger.warn(`Confirmation timeout — TX may still land: https://solscan.io/tx/${signature}`);
}

export async function getSolBalance(keypair: Keypair, connection: Connection): Promise<number> {
  try {
    return (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

export async function getUSDCBalance(keypair: Keypair, connection: Connection): Promise<number> {
  try {
    const ata = getAssociatedTokenAddressSync(USDC_MINT, keypair.publicKey);
    const acct = await getAccount(connection, ata);
    return Number(acct.amount) / Math.pow(10, USDC_DECIMALS);
  } catch { return 0; }
}

export async function checkBalances(
  keypair: Keypair,
  connection: Connection,
): Promise<{ sol: number; usdc: number }> {
  const [sol, usdc] = await Promise.all([
    getSolBalance(keypair, connection),
    getUSDCBalance(keypair, connection),
  ]);
  logger.info(
    `Wallet ${keypair.publicKey.toBase58().slice(0, 8)}... — SOL: ${sol.toFixed(4)}, USDC: ${usdc.toFixed(4)}`
  );
  if (sol  < 0.01) logger.warn(`⚠  Low SOL balance (${sol.toFixed(4)}). Need ≥ 0.01 SOL.`);
  if (usdc < 0.5)  logger.warn(`⚠  Low USDC balance (${usdc.toFixed(4)}). Need ≥ 0.5 USDC for Ace payments.`);
  return { sol, usdc };
}

export async function sendMemoTransaction(
  keypair: Keypair,
  connection: Connection,
  memoText: string,
): Promise<string> {
  // Use a public RPC for sending — the passed connection may be Synapse RPC
  const sendConn = await getPublicConnection();

  const memoBytes = Buffer.from(memoText, 'utf8').subarray(0, 566);
  logger.info(`On-chain memo (${memoBytes.length} bytes): ${memoText.slice(0, 100)}...`);

  const ix = new TransactionInstruction({
    keys:      [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data:      memoBytes,
  });

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await sendConn.getLatestBlockhash('confirmed');
  tx.recentBlockhash     = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer            = keypair.publicKey;
  tx.sign(keypair);

  const signature = await sendConn.sendRawTransaction(tx.serialize(), {
    skipPreflight:       true,
    preflightCommitment: 'confirmed',
    maxRetries:          5,
  });

  logger.info(`Memo TX sent: https://solscan.io/tx/${signature}`);
  await pollConfirmation(sendConn, signature);
  logger.info(`Memo TX confirmed ✓`);

  return signature;
}

export function walletAdapter(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: Transaction): Promise<Transaction> => {
      tx.partialSign(keypair);
      return tx;
    },
  };
}
