import type { Address, Hex } from 'viem';

/** Mirrors `CapabilityMarket.Resolution`. */
export enum Resolution {
  Unresolved = 0,
  ResolvedYes = 1,
  ResolvedNo = 2,
}

/** Mirrors `CapabilityMarket.Side`. */
export enum Side {
  YES = 0,
  NO = 1,
}

/**
 * Lifecycle phase derived from the market's timestamps against `now`. The
 * contract enforces the same windows at every entry point; we recompute them
 * client-side to decide what the miner can do right now.
 */
export type MarketPhase = 'staking' | 'commit' | 'reveal' | 'resolved' | 'timeout-open';

/** A decoded on-chain market plus its client-side derived phase. */
export interface Market {
  id: bigint;
  creator: Address;
  imageId: Hex;
  predicateArweaveTx: Hex;
  marketParamsHash: Hex;
  deadline: bigint;
  commitRevealWindow: bigint;
  lockWindowEnd: bigint;
  resolutionBountyBps: bigint;
  yesPool: bigint;
  noPool: bigint;
  resolution: Resolution;
  winner: Address;
  bountyPaid: bigint;
  /** Derived, not on-chain. */
  phase: MarketPhase;
}

/**
 * Derive the current phase from timestamps. `now` is unix seconds.
 *
 * Windows (from CapabilityMarket.sol):
 *   staking:  t <= lockWindowEnd
 *   commit:   lockWindowEnd < t <= deadline
 *   reveal:   deadline < t <= deadline + commitRevealWindow
 *   after:    t > deadline + commitRevealWindow (settleTimeout callable)
 */
export function derivePhase(
  m: {
    lockWindowEnd: bigint;
    deadline: bigint;
    commitRevealWindow: bigint;
    resolution: Resolution;
  },
  now: bigint,
): MarketPhase {
  if (m.resolution !== Resolution.Unresolved) return 'resolved';
  if (now <= m.lockWindowEnd) return 'staking';
  if (now <= m.deadline) return 'commit';
  if (now <= m.deadline + m.commitRevealWindow) return 'reveal';
  return 'timeout-open';
}
