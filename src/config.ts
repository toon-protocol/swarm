/**
 * Devnet configuration. The on-chain facts (addresses, chain id, deploy blocks)
 * are read from the committed deployment record, which mirrors
 * capability-market's `deployments/devnet.json`.
 */
import { createRequire } from 'node:module';
import type { Address } from 'viem';

const require = createRequire(import.meta.url);
// deployments/devnet.json lives at the package root, i.e. one level above src/.
const devnet = require('../deployments/devnet.json') as DevnetDeployment;

export interface DevnetDeployment {
  network: string;
  rpcUrl: string;
  chainId: number;
  addresses: {
    usdc: Address;
    groth16Verifier: Address;
    mockVerifier: Address;
    marketReal: Address;
    marketMock: Address;
  };
  usdcDecimals: number;
  risc0: Record<string, string>;
}

export type MarketKind = 'real' | 'mock';

export interface SwarmConfig {
  rpcUrl: string;
  chainId: number;
  /** Which deployed CapabilityMarket instance to watch. */
  market: MarketKind;
  /** Resolved address of the chosen market. */
  marketAddress: Address;
  usdc: Address;
  usdcDecimals: number;
  /** Present only when a miner key is configured (paid writes). */
  minerKey?: `0x${string}`;
}

export const deployment = devnet;

/**
 * Build a config from the environment, falling back to the committed devnet
 * record. Read-only commands need nothing but the defaults.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SwarmConfig {
  const market: MarketKind = env.SWARM_MARKET === 'real' ? 'real' : 'mock';
  const marketAddress =
    market === 'real' ? devnet.addresses.marketReal : devnet.addresses.marketMock;

  const minerKeyRaw = env.SWARM_MINER_KEY?.trim();
  const minerKey =
    minerKeyRaw && /^0x[0-9a-fA-F]{64}$/.test(minerKeyRaw)
      ? (minerKeyRaw as `0x${string}`)
      : undefined;

  return {
    rpcUrl: env.SWARM_RPC_URL?.trim() || devnet.rpcUrl,
    chainId: devnet.chainId,
    market,
    marketAddress,
    usdc: devnet.addresses.usdc,
    usdcDecimals: devnet.usdcDecimals,
    minerKey,
  };
}
