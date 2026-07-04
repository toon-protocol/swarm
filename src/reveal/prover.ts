/**
 * Proof generation for a reveal.
 *
 * The reveal needs `(proof, journal)` where `proof` is a seal the market's
 * RISC Zero verifier accepts and `journal` is the canonical 97 bytes. The
 * journal is deterministic (see journal.ts); the seal is what a prover produces.
 *
 * Two impls behind one interface:
 *   - {@link MockDevProver}: for the MOCK market (RiscZeroMockVerifier). Obtains
 *     an exact mock seal from the verifier's own `mockProve` view — genuinely
 *     accepted on-chain, but carries NO cryptographic soundness. Dev/test only.
 *   - {@link Groth16Prover}: the REAL path (Groth16 verifier). STUB — documents
 *     the capability-market RISC Zero toolchain / Bonsai / Kalypso dependency
 *     and throws. Real proving is not built here.
 */
import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { encodeJournal, type JournalFields } from './journal.js';

export interface ProofRequest {
  imageId: Hex;
  marketParamsHash: Hex;
  submissionHash: Hex;
  /** Raw submission bytes (what a real prover feeds the guest). */
  submission: Uint8Array;
}

export interface ProofBundle {
  /** Seal accepted by the market's verifier. */
  proof: Hex;
  /** Canonical 97-byte journal. */
  journal: Hex;
}

export interface Prover {
  readonly name: string;
  prove(req: ProofRequest): Promise<ProofBundle>;
}

function journalFor(req: ProofRequest): JournalFields {
  // A revealed submission is verdict=true by construction — the miner only
  // reveals schemes it verified locally.
  return {
    imageId: req.imageId,
    marketParamsHash: req.marketParamsHash,
    submissionHash: req.submissionHash,
    verdict: true,
  };
}

const mockVerifierAbi = [
  {
    type: 'function',
    name: 'mockProve',
    stateMutability: 'view',
    inputs: [
      { name: 'imageId', type: 'bytes32' },
      { name: 'journalDigest', type: 'bytes32' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'seal', type: 'bytes' },
          { name: 'claimDigest', type: 'bytes32' },
        ],
      },
    ],
  },
] as const;

/**
 * Dev-mode prover for the MOCK market. The journal digest is `sha256(journal)`;
 * we ask the on-chain `RiscZeroMockVerifier.mockProve` for the exact seal it
 * will later accept, so no client-side ReceiptClaim struct-hashing is needed.
 *
 * NOT a real proof: the mock verifier accepts any well-formed claim. Use only
 * against `marketMock`. Against `marketReal` the seal is rejected.
 */
export class MockDevProver implements Prover {
  readonly name = 'mock-dev (RiscZeroMockVerifier — no soundness)';
  private readonly client: PublicClient;

  constructor(
    private readonly opts: { rpcUrl: string; mockVerifier: Address },
  ) {
    this.client = createPublicClient({ transport: http(opts.rpcUrl) });
  }

  async prove(req: ProofRequest): Promise<ProofBundle> {
    const journal = encodeJournal(journalFor(req));
    const { sha256 } = await import('viem');
    const journalDigest = sha256(journal);
    const receipt = await this.client.readContract({
      address: this.opts.mockVerifier,
      abi: mockVerifierAbi,
      functionName: 'mockProve',
      args: [req.imageId, journalDigest],
    });
    return { proof: receipt.seal, journal };
  }
}

/** Thrown by the unbuilt real prover. */
export class ProverNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProverNotImplementedError';
  }
}

/**
 * Real Groth16 prover — STUB. Building this means driving the capability-market
 * RISC Zero toolchain (`predicates/`, r0vm/cargo-risczero 3.0.5) to execute the
 * guest over the submission and STARK→SNARK-compress to a Groth16 seal
 * (`risc0_ethereum::encode_seal`), or delegating to Bonsai / a Kalypso prover
 * (toon-meta#84 "Prover market: Kalypso, optional").
 *
 * Not built in v0. The journal is computed (deterministic) so the shape is
 * exercised, but no seal is produced.
 */
export class Groth16Prover implements Prover {
  readonly name = 'groth16 (real — NOT IMPLEMENTED)';

  async prove(req: ProofRequest): Promise<ProofBundle> {
    const journal = encodeJournal(journalFor(req));
    void journal;
    throw new ProverNotImplementedError(
      'Real Groth16 proving is not built in v0. Generate the seal via the ' +
        'capability-market RISC Zero toolchain (predicates/, r0vm 3.0.5, ' +
        'risc0_ethereum::encode_seal) or Bonsai/Kalypso, then submit it. ' +
        'See README scope table and toon-meta#119.',
    );
  }
}
