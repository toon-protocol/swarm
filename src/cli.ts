#!/usr/bin/env node
/**
 * swarm — capability-market miner CLI (toon-meta#84).
 *
 * Commands:
 *   swarm status            Connect to devnet; print market + client wiring.
 *   swarm watch [--once]    Discover markets; dry-run the solver on each.
 *                           [--interval=<sec>] [--submit]
 *   swarm dry-run [--bound] Run the matmul reference solver against a synthetic
 *                           local market and print the full reveal plan.
 *
 * v0 NEVER spends by default. Live commit/reveal requires BOTH --submit AND a
 * funded SWARM_MINER_KEY; even then v0's live path is minimal (see README).
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { deployment, loadConfig, type SwarmConfig } from './config.js';
import {
  buildDaemon,
  buildMarketClient,
  buildPipeline,
  buildRegistry,
  buildProver,
  buildGas,
} from './assemble.js';
import { demoMatmulMarket } from './demo.js';
import type { TickReport } from './daemon.js';

/** Tiny .env loader (no dependency). Non-fatal if absent. */
function loadDotenv(): void {
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]!] === undefined) {
        process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env — fine */
  }
}

function fmtDuration(secs: bigint): string {
  const s = Number(secs);
  if (s <= 0) return `${s}s (elapsed)`;
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

async function cmdStatus(config: SwarmConfig): Promise<void> {
  const client = buildMarketClient(config);
  const registry = buildRegistry();
  const prover = buildProver(config);
  const gas = buildGas(config);

  console.log('swarm — capability-market miner (toon-meta#84)\n');
  console.log(`network:        ${deployment.network}`);
  console.log(`rpc:            ${config.rpcUrl}`);

  let chainId: number;
  try {
    chainId = await client.chainId();
  } catch (err) {
    console.error(`\n✗ could not reach RPC: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`chainId:        ${chainId} (expected ${config.chainId})`);
  console.log(`market:         ${config.market}  ${config.marketAddress}`);
  console.log(`usdc:           ${config.usdc} (${config.usdcDecimals} decimals)`);

  try {
    const count = await client.marketCount();
    console.log(`marketCount:    ${count}`);
  } catch (err) {
    console.log(`marketCount:    <read failed: ${(err as Error).message}>`);
  }

  console.log('\nsolvers:');
  for (const s of registry.list()) console.log(`  • ${s.name}  [${s.imageId}]`);
  console.log(`prover:         ${prover.name}`);
  console.log(`gas:            ${gas ? gas.name + ' (' + gas.miner + ')' : 'none (read-only; set SWARM_MINER_KEY to enable writes)'}`);
}

function printTick(report: TickReport): void {
  console.log(`chainId ${report.chainId} — scanned ${report.scanned} actionable market(s), ${report.actionable} with a working solver.\n`);
  if (report.reports.length === 0) {
    console.log('No open markets in the staking/commit/reveal window right now.');
    console.log('(v0 discovery is a direct on-chain scan; markets are created by market authors.)');
    return;
  }
  for (const r of report.reports) {
    const m = r.market;
    console.log(`market #${m.id}  phase=${m.phase}  imageId=${m.imageId.slice(0, 18)}…`);
    console.log(`  deadline in ${fmtDuration(m.deadline - BigInt(Math.floor(Date.now() / 1000)))}  pools: YES=${m.yesPool} NO=${m.noPool}`);
    console.log(`  → ${r.action}${r.solverName ? '  via ' + r.solverName : ''}`);
    if (r.plan) {
      console.log(`     submissionHash: ${r.plan.submissionHash}`);
      console.log(`     commitmentHash: ${r.plan.commitmentHash}`);
      console.log(`     seal: ${r.plan.seal ? r.plan.seal.slice(0, 18) + '… (' + (r.plan.seal.length - 2) / 2 + ' bytes)' : 'none'}`);
    }
    if (r.error) console.log(`     error: ${r.error}`);
  }
}

async function cmdWatch(
  config: SwarmConfig,
  opts: { once: boolean; interval: number; submit: boolean },
): Promise<void> {
  const daemon = buildDaemon(config);
  if (opts.submit && !config.minerKey) {
    console.error('✗ --submit requires SWARM_MINER_KEY (a funded miner key). Refusing to continue.');
    process.exitCode = 1;
    return;
  }
  console.log(`swarm watch — market ${config.market} @ ${config.marketAddress}`);
  console.log(opts.submit ? '⚠ SUBMIT ENABLED — live writes may spend value.\n' : 'dry-run mode (no spending).\n');

  const runOnce = async () => {
    try {
      const report = await daemon.tick({ submit: opts.submit });
      printTick(report);
    } catch (err) {
      console.error(`tick failed: ${(err as Error).message}`);
    }
  };

  await runOnce();
  if (opts.once) return;

  console.log(`\nwatching every ${opts.interval}s — Ctrl-C to stop.`);
  // Long-running daemon loop.
  for (;;) {
    await new Promise((r) => setTimeout(r, opts.interval * 1000));
    console.log('\n— tick —');
    await runOnce();
  }
}

async function cmdDryRun(config: SwarmConfig, bound: number): Promise<void> {
  console.log(`swarm dry-run — matmul reference solver against a SYNTHETIC bound-${bound} market (not on-chain).\n`);
  const registry = buildRegistry([bound]);
  const pipeline = buildPipeline(config);
  const market = demoMatmulMarket(bound);
  const solver = registry.get(market.imageId)!;

  const submission = await solver.solve(market);
  if (!submission) {
    console.log(`solver produced NO submission for bound ${bound}.`);
    if (bound <= 46) console.log('(Expected: the rank-49 reference scheme does not beat the flagship bound 46 — that is the open problem.)');
    return;
  }
  console.log(`solver:  ${solver.name}`);
  console.log(`note:    ${submission.note}`);
  console.log(`submission bytes: ${submission.submission.length}`);

  const plan = await pipeline.plan(market, submission);
  console.log('\nreveal plan (spend-free):');
  console.log(`  submissionHash: ${plan.submissionHash}`);
  console.log(`  arweaveTx:      ${plan.arweaveTx}`);
  console.log(`  salt:           ${plan.salt}`);
  console.log(`  commitmentHash: ${plan.commitmentHash}`);
  console.log(`  prover:         ${plan.proverName ?? 'none'}`);
  console.log(`  journal:        ${plan.journal ?? 'none'}`);
  console.log(`  seal:           ${plan.seal ? plan.seal.slice(0, 26) + '… (' + (plan.seal.length - 2) / 2 + ' bytes)' : 'none'}`);
  console.log('\nnotes:');
  for (const n of plan.notes) console.log(`  - ${n}`);
}

async function main(): Promise<void> {
  loadDotenv();
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      once: { type: 'boolean', default: false },
      submit: { type: 'boolean', default: false },
      interval: { type: 'string', default: '30' },
      bound: { type: 'string', default: '49' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const command = positionals[0] ?? 'status';
  const config = loadConfig();

  if (values.help) {
    console.log('usage: swarm <status|watch|dry-run> [--once] [--interval=<sec>] [--submit] [--bound=<n>]');
    return;
  }

  switch (command) {
    case 'status':
      await cmdStatus(config);
      break;
    case 'watch':
      await cmdWatch(config, {
        once: values.once,
        interval: Number(values.interval),
        submit: values.submit,
      });
      break;
    case 'dry-run':
      await cmdDryRun(config, Number(values.bound));
      break;
    default:
      console.error(`unknown command: ${command}`);
      console.error('usage: swarm <status|watch|dry-run>');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
