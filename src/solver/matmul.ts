/**
 * Reference solver for the flagship matmul predicate (toon-meta#122).
 *
 * This is a faithful TypeScript port of capability-market's
 * `predicates/crates/matmul` — the scheme constructor, the GF(2) codec, and the
 * symbolic verifier — so the miner can (a) construct the known rank-49
 * Strassen⊗Strassen scheme and (b) self-check it before spending gas.
 *
 * IMPORTANT / HONEST SCOPE: the flagship market pins bound 46 and the rank-49
 * scheme does NOT satisfy it (rank 49 > 46). Beating 46 is the OPEN research
 * problem this market prices; this solver does not claim to. It is a *reference*
 * solver: for any market with bound >= 49 it produces a genuinely valid winning
 * submission, exercising the whole commit→prove→reveal pipeline end to end.
 */
import { sha256, toHex, type Hex } from 'viem';
import type { Market } from '../market/types.js';
import { type Solver, type Submission, submissionFromBytes } from './types.js';

/** RISC Zero image id of the matmul guest (capability-market ARTIFACTS.json). */
export const MATMUL_IMAGE_ID: Hex =
  '0x660d47e33136b07e362d5efac8669ee3d31603df5aa5c12dba41f91156e8ecff';

/** The flagship market's pinned rank bound (the open target). */
export const FLAGSHIP_RANK_BOUND = 46;

const ENTRIES = 16;

export interface Triple {
  /** GF(2) coefficients over the 16 entries of A (bit j ↔ A[j/4][j%4]). */
  u: number;
  /** GF(2) coefficients over the 16 entries of B. */
  v: number;
  /** GF(2) coefficients over the 16 entries of C = AB this product feeds. */
  w: number;
}

/**
 * Strassen's rank-7 scheme for 2×2 matmul, valid over GF(2) (signs vanish mod
 * 2). Bit j addresses entry (j/2, j%2) of the 2×2 matrix.
 */
const STRASSEN_2X2: ReadonlyArray<readonly [number, number, number]> = [
  [0b1001, 0b1001, 0b1001],
  [0b1100, 0b0001, 0b1100],
  [0b0001, 0b1010, 0b1010],
  [0b1000, 0b0101, 0b0101],
  [0b0011, 0b1000, 0b0011],
  [0b0101, 0b0011, 0b1000],
  [0b1010, 0b1100, 0b0001],
];

/**
 * Kronecker-lift a 2×2-level mask pair (outer over blocks, inner within a
 * block) to a 4×4-level 16-bit mask: entry (2·br+ir, 2·bc+ic) is set iff outer
 * bit (br,bc) and inner bit (ir,ic) are both set.
 */
function tensor(outer: number, inner: number): number {
  let out = 0;
  for (let ob = 0; ob < 4; ob++) {
    if ((outer >> ob) & 1) {
      const br = Math.floor(ob / 2);
      const bc = ob % 2;
      for (let ib = 0; ib < 4; ib++) {
        if ((inner >> ib) & 1) {
          const ir = Math.floor(ib / 2);
          const ic = ib % 2;
          out |= 1 << ((2 * br + ir) * 4 + (2 * bc + ic));
        }
      }
    }
  }
  return out;
}

/** The rank-49 scheme for 4×4 matmul over GF(2): Strassen recursed once (7×7). */
export function strassen4x4Rank49(): Triple[] {
  const out: Triple[] = [];
  for (const [uo, vo, wo] of STRASSEN_2X2) {
    for (const [ui, vi, wi] of STRASSEN_2X2) {
      out.push({ u: tensor(uo, ui), v: tensor(vo, vi), w: tensor(wo, wi) });
    }
  }
  return out;
}

/** Serialize a scheme to `matmul-submission-v1` bytes (u16 BE ×3 per triple). */
export function encodeScheme(triples: Triple[]): Uint8Array {
  const out = new Uint8Array(triples.length * 6);
  triples.forEach((t, i) => {
    const o = i * 6;
    out[o] = (t.u >> 8) & 0xff;
    out[o + 1] = t.u & 0xff;
    out[o + 2] = (t.v >> 8) & 0xff;
    out[o + 3] = t.v & 0xff;
    out[o + 4] = (t.w >> 8) & 0xff;
    out[o + 5] = t.w & 0xff;
  });
  return out;
}

/** Serialize a rank bound to `matmul-market-params-v1` (`abi.encode(uint256)`). */
export function encodeMarketParams(bound: number): Uint8Array {
  const out = new Uint8Array(32);
  out[28] = (bound >>> 24) & 0xff;
  out[29] = (bound >>> 16) & 0xff;
  out[30] = (bound >>> 8) & 0xff;
  out[31] = bound & 0xff;
  return out;
}

/** `sha256(encodeMarketParams(bound))` — matches the on-chain marketParamsHash. */
export function marketParamsHash(bound: number): Hex {
  return sha256(toHex(encodeMarketParams(bound)));
}

export type Reject =
  | { kind: 'EmptyScheme' }
  | { kind: 'DegenerateProduct'; index: number }
  | { kind: 'RankExceeded'; rank: number; bound: number }
  | { kind: 'DuplicateProduct'; first: number; second: number }
  | { kind: 'NotMatmul'; output: number };

/**
 * Symbolic GF(2) polynomial-identity check — the exact verifier the RISC Zero
 * guest runs, ported for pre-flight self-checking. Check order mirrors the Rust
 * `verify_scheme`: empty → degenerate → rank → duplicate → identity.
 */
export function verifyScheme(triples: Triple[], bound: number): Reject | null {
  if (triples.length === 0) return { kind: 'EmptyScheme' };
  for (let i = 0; i < triples.length; i++) {
    const t = triples[i]!;
    if (t.u === 0 || t.v === 0 || t.w === 0) return { kind: 'DegenerateProduct', index: i };
  }
  if (triples.length > bound) {
    return { kind: 'RankExceeded', rank: triples.length, bound };
  }
  for (let i = 0; i < triples.length; i++) {
    for (let j = i + 1; j < triples.length; j++) {
      if (triples[i]!.u === triples[j]!.u && triples[i]!.v === triples[j]!.v) {
        return { kind: 'DuplicateProduct', first: i, second: j };
      }
    }
  }
  return checkIdentity(triples);
}

function checkIdentity(triples: Triple[]): Reject | null {
  for (let o = 0; o < ENTRIES; o++) {
    const p = Math.floor(o / 4);
    const q = o % 4;
    const m = new Array<number>(ENTRIES).fill(0);
    for (const t of triples) {
      if ((t.w >> o) & 1) {
        for (let j = 0; j < ENTRIES; j++) {
          if ((t.u >> j) & 1) m[j]! ^= t.v;
        }
      }
    }
    const target = new Array<number>(ENTRIES).fill(0);
    for (let t = 0; t < 4; t++) {
      target[4 * p + t]! |= 1 << (4 * t + q);
    }
    for (let j = 0; j < ENTRIES; j++) {
      if (m[j] !== target[j]) return { kind: 'NotMatmul', output: o };
    }
  }
  return null;
}

/**
 * The matmul reference solver. Keyed by {@link MATMUL_IMAGE_ID}.
 *
 * Because a market stores only `sha256(params)` on-chain (not the raw bound),
 * the solver needs the params preimage to know the market's rank bound. It
 * keeps a small registry of known bounds (seed it with {@link registerBound}).
 * The flagship bound 46 is pre-registered — and correctly yields `null`, since
 * the rank-49 scheme does not beat 46.
 *
 * FUTURE: the params preimage should arrive over the market-announcement feed
 * (relay event / Arweave manifest), not a hand-seeded registry.
 */
export class MatmulReferenceSolver implements Solver {
  readonly imageId = MATMUL_IMAGE_ID;
  readonly name = 'matmul-reference (Strassen⊗Strassen rank-49)';

  /** marketParamsHash → bound, for markets whose params preimage we know. */
  private readonly knownBounds = new Map<Hex, number>();

  constructor(bounds: number[] = [FLAGSHIP_RANK_BOUND]) {
    for (const b of bounds) this.registerBound(b);
  }

  /** Register a known rank bound so its markets become solvable/judgeable. */
  registerBound(bound: number): Hex {
    const h = marketParamsHash(bound).toLowerCase() as Hex;
    this.knownBounds.set(h, bound);
    return h;
  }

  async solve(market: Market): Promise<Submission | null> {
    if (market.imageId.toLowerCase() !== this.imageId.toLowerCase()) return null;

    const bound = this.knownBounds.get(market.marketParamsHash.toLowerCase() as Hex);
    if (bound === undefined) {
      // Params preimage unknown: only the hash is on-chain. Cannot judge rank.
      return null;
    }

    const scheme = strassen4x4Rank49();
    const reject = verifyScheme(scheme, bound);
    if (reject) {
      // e.g. flagship bound 46 → RankExceeded. Honestly: no answer.
      return null;
    }

    const bytes = encodeScheme(scheme);
    return submissionFromBytes(
      bytes,
      `rank-49 Strassen⊗Strassen, valid at bound ${bound} (${scheme.length} products)`,
    );
  }
}
