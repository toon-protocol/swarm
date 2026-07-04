/**
 * Market discovery + read access over the devnet RPC.
 *
 * v0 discovery is a direct on-chain scan: markets live entirely in
 * `CapabilityMarket.sol` — there is no relay-event announcement layer yet. We
 * read `marketCount()` and pull each `getMarket(i)` struct. (Event-log scanning
 * of `MarketCreated` is also wired for provenance / block ranges.)
 *
 * FUTURE (toon-meta#84 "event substrate"): markets announce over the TOON relay
 * as kind:10032-style events so clients discover without RPC-polling every id.
 * That path is not built; see README scope table.
 */
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from 'viem';
import { capabilityMarketAbi } from '../abi.js';
import { derivePhase, Resolution, type Market } from './types.js';

export interface MarketClientOptions {
  rpcUrl: string;
  marketAddress: Address;
}

export class MarketClient {
  readonly public: PublicClient;
  readonly address: Address;

  constructor(opts: MarketClientOptions) {
    this.address = opts.marketAddress;
    this.public = createPublicClient({ transport: http(opts.rpcUrl) });
  }

  /** `eth_chainId` — cheap connectivity probe. */
  async chainId(): Promise<number> {
    return this.public.getChainId();
  }

  async marketCount(): Promise<bigint> {
    return this.public.readContract({
      address: this.address,
      abi: capabilityMarketAbi,
      functionName: 'marketCount',
    });
  }

  /** Read and decode a single market by id, deriving its current phase. */
  async getMarket(id: bigint, now?: bigint): Promise<Market> {
    const raw = await this.public.readContract({
      address: this.address,
      abi: capabilityMarketAbi,
      functionName: 'getMarket',
      args: [id],
    });
    const nowSec = now ?? BigInt(Math.floor(Date.now() / 1000));
    const resolution = raw.resolution as Resolution;
    return {
      id,
      creator: raw.creator,
      imageId: raw.imageId,
      predicateArweaveTx: raw.predicateArweaveTx,
      marketParamsHash: raw.marketParamsHash,
      deadline: raw.deadline,
      commitRevealWindow: raw.commitRevealWindow,
      lockWindowEnd: raw.lockWindowEnd,
      resolutionBountyBps: raw.resolutionBountyBps,
      yesPool: raw.yesPool,
      noPool: raw.noPool,
      resolution,
      winner: raw.winner,
      bountyPaid: raw.bountyPaid,
      phase: derivePhase(
        { ...raw, resolution },
        nowSec,
      ),
    };
  }

  /**
   * List all markets, newest last. Direct struct scan over `[0, marketCount)`.
   * Cheap on devnet where market counts are tiny; a production client would
   * page and cache, or move to the relay-event discovery path.
   */
  async listMarkets(): Promise<Market[]> {
    const count = await this.marketCount();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const out: Market[] = [];
    for (let i = 0n; i < count; i++) {
      out.push(await this.getMarket(i, now));
    }
    return out;
  }

  /**
   * The miner's working set: markets a solver could still act on — i.e. not yet
   * resolved and inside (or before) the reveal window.
   */
  async watchMarkets(): Promise<Market[]> {
    const all = await this.listMarkets();
    return all.filter(
      (m) => m.phase === 'staking' || m.phase === 'commit' || m.phase === 'reveal',
    );
  }
}
