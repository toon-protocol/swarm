/**
 * @toon-protocol/swarm — capability-market miner (toon-meta#84).
 *
 * Public surface: market discovery, the pluggable solver interface + the matmul
 * reference solver, and the commit→prove→reveal pipeline. See README for the
 * v0-vs-future scope table.
 */
export * from './config.js';
export { capabilityMarketAbi } from './abi.js';

// Market discovery
export { MarketClient } from './market/client.js';
export * from './market/types.js';

// Solvers
export * from './solver/types.js';
export { SolverRegistry } from './solver/registry.js';
export {
  MatmulReferenceSolver,
  MATMUL_IMAGE_ID,
  FLAGSHIP_RANK_BOUND,
  strassen4x4Rank49,
  encodeScheme,
  encodeMarketParams,
  marketParamsHash,
  verifyScheme,
  type Triple,
  type Reject,
} from './solver/matmul.js';
export { LlmSolver, type LlmSolverOptions } from './solver/llm.js';

// Reveal pipeline
export * from './reveal/journal.js';
export * from './reveal/commitment.js';
export {
  RevealPipeline,
  type RevealPlan,
  type CommitContext,
  type RevealPipelineDeps,
} from './reveal/pipeline.js';
export {
  MockDevProver,
  Groth16Prover,
  ProverNotImplementedError,
  type Prover,
  type ProofBundle,
  type ProofRequest,
} from './reveal/prover.js';
export {
  DirectNativeGas,
  BundlerDvmGas,
  GasStrategyNotImplementedError,
  type GasStrategy,
  type PreparedCall,
} from './reveal/gas.js';
export {
  NullUploader,
  ClientArweaveUploader,
  type Uploader,
  type UploadResult,
} from './reveal/arweave.js';

// Daemon
export {
  SwarmDaemon,
  type SwarmDaemonDeps,
  type TickReport,
  type MarketReport,
} from './daemon.js';
