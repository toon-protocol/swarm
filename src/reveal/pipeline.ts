/**
 * The reveal pipeline: commit → prove → reveal against a CapabilityMarket.
 *
 * v0 wires the full shape end to end. `plan()` computes every artifact
 * (upload, commitment, journal, seal) spend-free — for the mock market it even
 * produces a genuinely verifier-accepted seal via the read-only `mockProve`
 * view — so the whole flow is exercised without landing a transaction. The
 * paid steps (`commit`, `reveal`) require a GasStrategy with a funded key and
 * are only reached behind an explicit opt-in.
 */
import type { Address, Hex } from 'viem';
import { capabilityMarketAbi } from '../abi.js';
import type { Market } from '../market/types.js';
import type { Submission } from '../solver/types.js';
import {
  arweaveTxToBytes32,
  computeCommitment,
  randomSalt,
} from './commitment.js';
import { NullUploader, type Uploader } from './arweave.js';
import type { GasStrategy } from './gas.js';
import type { Prover, ProofBundle } from './prover.js';

export interface RevealPipelineDeps {
  marketAddress: Address;
  uploader?: Uploader;
  prover?: Prover;
  /** Required only for paid writes (commit/reveal). */
  gas?: GasStrategy;
}

/** Everything the pipeline can compute spend-free for a candidate submission. */
export interface RevealPlan {
  marketId: bigint;
  miner: Address | null;
  submissionHash: Hex;
  arweaveTxId: string;
  arweaveTx: Hex;
  salt: Hex;
  commitmentHash: Hex;
  journal: Hex | null;
  /** Present when a prover produced a seal (mock market, read-only). */
  seal: Hex | null;
  proverName: string | null;
  /** Non-fatal notes: what was skipped/stubbed and why. */
  notes: string[];
}

/** Context carried from commit to the later reveal. */
export interface CommitContext {
  marketId: bigint;
  submission: Submission;
  arweaveTxId: string;
  arweaveTx: Hex;
  salt: Hex;
  commitmentHash: Hex;
  commitTxHash: Hex;
}

export class RevealPipeline {
  private readonly uploader: Uploader;

  constructor(private readonly deps: RevealPipelineDeps) {
    this.uploader = deps.uploader ?? new NullUploader();
  }

  /**
   * Compute the full reveal plan without spending. Uploads nothing by default
   * (NullUploader) and, for a prover that can prove read-only (mock verifier),
   * produces the real seal + journal. Uses a fresh sample salt / the miner
   * address if a GasStrategy is present, else a zero placeholder.
   */
  async plan(market: Market, submission: Submission): Promise<RevealPlan> {
    const notes: string[] = [];
    const miner = this.deps.gas?.miner ?? null;
    const commitMiner: Address = miner ?? `0x${'00'.repeat(20)}`;
    if (!miner) {
      notes.push('No GasStrategy/miner key: commitment computed against the zero address (dry-run only).');
    }

    const salt = randomSalt();
    const arweaveTx = arweaveTxToBytes32(undefined);
    notes.push('Dry-run: submission NOT uploaded to Arweave (arweaveTx = 0x00…).');

    const commitmentHash = computeCommitment({
      solutionHash: submission.submissionHash,
      arweaveTx,
      miner: commitMiner,
      salt,
    });

    let journal: Hex | null = null;
    let seal: Hex | null = null;
    let proverName: string | null = null;
    if (this.deps.prover) {
      proverName = this.deps.prover.name;
      try {
        const bundle = await this.deps.prover.prove({
          imageId: market.imageId,
          marketParamsHash: market.marketParamsHash,
          submissionHash: submission.submissionHash,
          submission: submission.submission,
        });
        journal = bundle.journal;
        seal = bundle.proof;
        notes.push(`Prover ${this.deps.prover.name} produced a seal (${(bundle.proof.length - 2) / 2} bytes).`);
      } catch (err) {
        notes.push(`Prover ${this.deps.prover.name} did not produce a seal: ${(err as Error).message}`);
      }
    } else {
      notes.push('No prover configured: journal/seal not computed.');
    }

    return {
      marketId: market.id,
      miner,
      submissionHash: submission.submissionHash,
      arweaveTxId: '',
      arweaveTx,
      salt,
      commitmentHash,
      journal,
      seal,
      proverName,
      notes,
    };
  }

  private requireGas(): GasStrategy {
    if (!this.deps.gas) {
      throw new Error(
        'Paid write requires a GasStrategy (funded miner key). v0 never spends ' +
          'without an explicit --submit and SWARM_MINER_KEY.',
      );
    }
    return this.deps.gas;
  }

  /** LIVE: upload the submission and land the commitment (spends gas). */
  async commit(market: Market, submission: Submission): Promise<CommitContext> {
    const gas = this.requireGas();
    const arweaveTxId = await this.uploader.upload(submission.submission, 'application/octet-stream');
    const arweaveTx = arweaveTxToBytes32(arweaveTxId || undefined);
    const salt = randomSalt();
    const commitmentHash = computeCommitment({
      solutionHash: submission.submissionHash,
      arweaveTx,
      miner: gas.miner,
      salt,
    });
    const commitTxHash = await gas.submit({
      address: this.deps.marketAddress,
      abi: capabilityMarketAbi as unknown as import("viem").Abi,
      functionName: 'commit',
      args: [market.id, commitmentHash],
    });
    return { marketId: market.id, submission, arweaveTxId, arweaveTx, salt, commitmentHash, commitTxHash };
  }

  /** LIVE: prove and reveal a previously committed submission (spends gas). */
  async reveal(ctx: CommitContext, market: Market): Promise<{ txHash: Hex; bundle: ProofBundle }> {
    const gas = this.requireGas();
    if (!this.deps.prover) throw new Error('reveal requires a Prover');
    const bundle = await this.deps.prover.prove({
      imageId: market.imageId,
      marketParamsHash: market.marketParamsHash,
      submissionHash: ctx.submission.submissionHash,
      submission: ctx.submission.submission,
    });
    const txHash = await gas.submit({
      address: this.deps.marketAddress,
      abi: capabilityMarketAbi as unknown as import("viem").Abi,
      functionName: 'reveal',
      args: [
        ctx.marketId,
        ctx.submission.submissionHash,
        ctx.arweaveTx,
        ctx.salt,
        bundle.proof,
        bundle.journal,
      ],
    });
    return { txHash, bundle };
  }
}
