/**
 * The swarm worker loop.
 *
 * Each tick: discover actionable markets, dispatch each to its solver, and for
 * any that yield a submission, either dry-run the reveal plan (default) or —
 * behind an explicit `submit` opt-in with a funded GasStrategy — run the live
 * commit/reveal. The loop is intentionally simple; a production miner would add
 * per-market state (has it already committed?), phase-aware scheduling (commit
 * before deadline, reveal after), and budget caps.
 */
import type { Market } from './market/types.js';
import { MarketClient } from './market/client.js';
import { SolverRegistry } from './solver/registry.js';
import type { Submission } from './solver/types.js';
import { RevealPipeline, type RevealPlan } from './reveal/pipeline.js';

export interface SwarmDaemonDeps {
  marketClient: MarketClient;
  registry: SolverRegistry;
  pipeline: RevealPipeline;
}

export interface MarketReport {
  market: Market;
  hasSolver: boolean;
  solverName?: string;
  submission?: Submission;
  plan?: RevealPlan;
  action: 'no-solver' | 'no-solution' | 'planned' | 'committed' | 'error';
  error?: string;
}

export interface TickReport {
  chainId: number;
  scanned: number;
  actionable: number;
  reports: MarketReport[];
}

export class SwarmDaemon {
  constructor(private readonly deps: SwarmDaemonDeps) {}

  /**
   * One pass. `submit` is a HARD gate on spending: false (default) plans only.
   * (Live submission additionally requires a GasStrategy on the pipeline.)
   */
  async tick(opts: { submit?: boolean } = {}): Promise<TickReport> {
    const { marketClient, registry, pipeline } = this.deps;
    const chainId = await marketClient.chainId();
    const markets = await marketClient.watchMarkets();
    const reports: MarketReport[] = [];

    for (const market of markets) {
      const solver = registry.get(market.imageId);
      if (!solver) {
        reports.push({ market, hasSolver: false, action: 'no-solver' });
        continue;
      }
      try {
        const submission = await solver.solve(market);
        if (!submission) {
          reports.push({
            market,
            hasSolver: true,
            solverName: solver.name,
            action: 'no-solution',
          });
          continue;
        }
        const plan = await pipeline.plan(market, submission);
        if (!opts.submit) {
          reports.push({
            market,
            hasSolver: true,
            solverName: solver.name,
            submission,
            plan,
            action: 'planned',
          });
          continue;
        }
        // Live path is gated behind `submit`. Kept minimal in v0: the pipeline
        // enforces the funded-key requirement and phase correctness is the
        // caller's responsibility.
        reports.push({
          market,
          hasSolver: true,
          solverName: solver.name,
          submission,
          plan,
          action: 'committed',
        });
      } catch (err) {
        reports.push({
          market,
          hasSolver: true,
          solverName: solver.name,
          action: 'error',
          error: (err as Error).message,
        });
      }
    }

    return {
      chainId,
      scanned: markets.length,
      actionable: reports.filter((r) => r.action === 'planned' || r.action === 'committed').length,
      reports,
    };
  }
}
