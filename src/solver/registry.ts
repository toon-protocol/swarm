import type { Hex } from 'viem';
import type { Market } from '../market/types.js';
import type { Solver, Submission } from './types.js';

/** A solver dispatch table keyed by RISC Zero image id. */
export class SolverRegistry {
  private readonly byImageId = new Map<Hex, Solver>();

  register(solver: Solver): this {
    this.byImageId.set(solver.imageId.toLowerCase() as Hex, solver);
    return this;
  }

  get(imageId: Hex): Solver | undefined {
    return this.byImageId.get(imageId.toLowerCase() as Hex);
  }

  has(imageId: Hex): boolean {
    return this.byImageId.has(imageId.toLowerCase() as Hex);
  }

  list(): Solver[] {
    return [...this.byImageId.values()];
  }

  /** Dispatch a market to its solver by image id. `null` if none registered. */
  async solve(market: Market): Promise<Submission | null> {
    const solver = this.get(market.imageId);
    if (!solver) return null;
    return solver.solve(market);
  }
}
