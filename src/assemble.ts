/**
 * Dependency assembly — wires a config into the market client, solver registry,
 * prover, and reveal pipeline. Kept separate from the CLI so it is unit-testable.
 */
import { deployment, type SwarmConfig } from './config.js';
import { MarketClient } from './market/client.js';
import { SolverRegistry } from './solver/registry.js';
import { MatmulReferenceSolver, FLAGSHIP_RANK_BOUND } from './solver/matmul.js';
import { RevealPipeline } from './reveal/pipeline.js';
import { MockDevProver, Groth16Prover, type Prover } from './reveal/prover.js';
import { DirectNativeGas, type GasStrategy } from './reveal/gas.js';
import { SwarmDaemon } from './daemon.js';

export function buildMarketClient(config: SwarmConfig): MarketClient {
  return new MarketClient({ rpcUrl: config.rpcUrl, marketAddress: config.marketAddress });
}

/**
 * The solver registry. The matmul reference solver is registered with the known
 * bounds it can win at — the flagship 46 (which it correctly declines) plus any
 * `extraBounds` (e.g. 49 for the dry-run demo).
 */
export function buildRegistry(extraBounds: number[] = []): SolverRegistry {
  const matmul = new MatmulReferenceSolver([FLAGSHIP_RANK_BOUND, ...extraBounds]);
  return new SolverRegistry().register(matmul);
}

/** Prover for the chosen market: mock verifier → MockDevProver, real → stub. */
export function buildProver(config: SwarmConfig): Prover {
  if (config.market === 'mock') {
    return new MockDevProver({
      rpcUrl: config.rpcUrl,
      mockVerifier: deployment.addresses.mockVerifier,
    });
  }
  return new Groth16Prover();
}

/** GasStrategy only if a miner key is configured (paid writes). */
export function buildGas(config: SwarmConfig): GasStrategy | undefined {
  if (!config.minerKey) return undefined;
  return new DirectNativeGas({ rpcUrl: config.rpcUrl, privateKey: config.minerKey });
}

export function buildPipeline(config: SwarmConfig): RevealPipeline {
  return new RevealPipeline({
    marketAddress: config.marketAddress,
    prover: buildProver(config),
    gas: buildGas(config),
  });
}

export function buildDaemon(config: SwarmConfig, extraBounds: number[] = []): SwarmDaemon {
  return new SwarmDaemon({
    marketClient: buildMarketClient(config),
    registry: buildRegistry(extraBounds),
    pipeline: buildPipeline(config),
  });
}
