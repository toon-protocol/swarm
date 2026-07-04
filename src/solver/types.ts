import { sha256, toHex, type Hex } from 'viem';
import type { Market } from '../market/types.js';

/**
 * A solver's output: the raw submission bytes it wants judged, plus the
 * `submissionHash` the predicate journal will bind (`sha256(submission)`).
 *
 * `submissionHash` IS the `solutionHash` the reveal commits to — the on-chain
 * `reveal` requires `journal.submissionHash == solutionHash`, and the journal
 * hashes the raw submission bytes. So the miner computes it here.
 */
export interface Submission {
  /** Raw `<predicate>-submission-v1` bytes (predicate-specific encoding). */
  submission: Uint8Array;
  /** `sha256(submission)` — the solutionHash bound on-chain. */
  submissionHash: Hex;
  /** Human-readable note for logs / dry-runs. */
  note?: string;
}

/**
 * A pluggable predicate solver, keyed by RISC Zero image id.
 *
 * `solve` returns a candidate submission, or `null` when this solver has no
 * answer for the given market (wrong predicate, bound too tight, gave up).
 * It MUST NOT touch the chain — solving is pure; the reveal pipeline handles
 * commit/prove/reveal.
 */
export interface Solver {
  /** RISC Zero image id (32-byte hex) this solver answers for. */
  readonly imageId: Hex;
  /** Short identifier for logs. */
  readonly name: string;
  solve(market: Market): Promise<Submission | null>;
}

/** Build a {@link Submission} from raw bytes, computing its hash. */
export function submissionFromBytes(bytes: Uint8Array, note?: string): Submission {
  return {
    submission: bytes,
    submissionHash: sha256(toHex(bytes)),
    note,
  };
}
