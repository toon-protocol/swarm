/**
 * Synthetic local market descriptors for demonstrating the solver + reveal
 * pipeline WITHOUT a matching market existing on devnet. Clearly NOT on-chain —
 * used only by `swarm dry-run` to exercise the reference solver end to end.
 */
import type { Address } from 'viem';
import { Resolution, type Market } from './market/types.js';
import { MATMUL_IMAGE_ID, marketParamsHash } from './solver/matmul.js';

const ZERO_ADDR: Address = `0x${'00'.repeat(20)}`;

/**
 * A synthetic matmul market at the given rank bound (default 49, where the
 * reference rank-49 scheme is a valid winning submission). NOT a real market.
 */
export function demoMatmulMarket(bound = 49): Market {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return {
    id: -1n,
    creator: ZERO_ADDR,
    imageId: MATMUL_IMAGE_ID,
    predicateArweaveTx: `0x${'00'.repeat(32)}`,
    marketParamsHash: marketParamsHash(bound),
    deadline: now + 3600n,
    commitRevealWindow: 3600n,
    lockWindowEnd: now - 1n, // already in the commit window
    resolutionBountyBps: 50n,
    yesPool: 0n,
    noPool: 0n,
    resolution: Resolution.Unresolved,
    winner: ZERO_ADDR,
    bountyPaid: 0n,
    phase: 'commit',
  };
}
