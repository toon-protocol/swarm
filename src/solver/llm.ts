/**
 * LLM-driven solver — THE real research surface of @toon-protocol/swarm, and
 * the reason it is "swarm": an LLM (Claude first) is handed a sealed predicate
 * and attempts to construct a satisfying submission.
 *
 * STATUS: STUB. This scaffolds the SHAPE only. Wiring an LLM into a
 * predicate-solving loop — prompt construction from the predicate manifest,
 * tool-use for candidate generation, local verification against the ported
 * predicate check, iterate-until-valid, budget/attempt caps — is deliberately
 * left as the open build. Nothing here calls a model.
 *
 * See toon-meta#84 "Mining client is a separate package" and the README scope
 * table: the LLM solver is stubbed, not functional.
 */
import type { Hex } from 'viem';
import type { Market } from '../market/types.js';
import type { Solver, Submission } from './types.js';

export interface LlmSolverOptions {
  /** Image id this LLM solver is pointed at. */
  imageId: Hex;
  /** Model id, e.g. an Anthropic Claude model. Unused until wired. */
  model?: string;
  /** Max candidate-generation attempts before giving up. */
  maxAttempts?: number;
}

export class LlmSolver implements Solver {
  readonly imageId: Hex;
  readonly name: string;
  private readonly options: LlmSolverOptions;

  constructor(options: LlmSolverOptions) {
    this.imageId = options.imageId;
    this.options = { maxAttempts: 8, ...options };
    this.name = `llm-solver[${options.model ?? 'unwired'}]`;
  }

  async solve(_market: Market): Promise<Submission | null> {
    // TODO(toon-meta#84): the actual research loop.
    //   1. Fetch the predicate manifest (image id → Arweave predicate bytes +
    //      params preimage) so the model knows what it is being asked to satisfy.
    //   2. Build a prompt describing the predicate + the submission encoding.
    //   3. Ask the model (Claude, via the Anthropic SDK / an MCP tool surface)
    //      for a candidate submission.
    //   4. Verify the candidate LOCALLY against the ported predicate check
    //      (never spend gas on an unverified candidate).
    //   5. On failure, feed the rejection reason back and retry up to
    //      `maxAttempts`; on success, return the Submission.
    //
    // Until that loop exists this solver has no answer for any market.
    void this.options;
    return null;
  }
}
