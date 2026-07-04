# @toon-protocol/swarm

Capability-market **miner** — a daemon-shaped worker that connects an LLM
(Claude first) to the [TOON capability market][cm]: it watches the market feed,
works on sealed-predicate solutions, and submits reveals.

Umbrella epic: [toon-meta#84][84]. The market itself (contract + predicates) is
[toon-protocol/capability-market][cm]; this is the client that mines it. Per
[#84][84], the mining client is a **separate package** — this repo.

> **Status: v0 scaffold.** This is an honest skeleton, not a finished miner.
> Market discovery, the matmul **reference** solver, and the commit→prove→reveal
> plumbing are real and run against devnet. The LLM solver, real (Groth16)
> proving, gas abstraction, and relay-based discovery are **stubbed** behind
> their interfaces. See the [scope table](#v0-scope--whats-real-vs-stubbed).

## How it relates to the rest of the stack

The capability market prices **open-frontier propositions** — "where is the edge
of what's currently possible." A market freezes a machine-checkable predicate
(a RISC Zero image id), takes parimutuel USDC stakes, and settles trustlessly
when a miner reveals a solution with a zkVM proof that the predicate returned
`true`.

- [capability-market][cm] — `CapabilityMarket.sol` escrow ([#120][120]) + the
  RISC Zero predicate toolchain ([#119][119], predicate `journal-v1` [#121][121]).
  The flagship predicate ([#122]) is 4×4 matmul rank ≤ 46 over GF(2).
- **`@toon-protocol/swarm` (this repo)** — the miner. Interoperates over
  `CapabilityMarket.sol` like any other client. Depends on
  [`@toon-protocol/client`][client] for identity and the Arweave submission
  upload (store/Turbo path) — an *optional* dependency; read-only commands run
  without it.
- Escrow is **direct-USDC on-chain**, NOT integrated with TOON payment channels
  ([#84][84] decided fork), so all market interaction here is plain EVM calls via
  [viem].
- Gas abstraction (pay reveal gas in any token via a bundler DVM) is
  [#125][125] — a separate umbrella, **not built here**.

## Install & run

```sh
npm install
npm run build

# Read-only — needs only the devnet RPC (baked into deployments/devnet.json):
node dist/cli.js status            # connectivity + wiring
node dist/cli.js watch --once      # scan open markets, dry-run the solver
node dist/cli.js dry-run --bound 49  # full reveal plan for the reference solver
```

`swarm` **never spends by default.** A live `commit`/`reveal` requires *both*
`--submit` *and* a funded `SWARM_MINER_KEY` (see `.env.example`). Even then, v0's
live write path is intentionally minimal.

### What you'll see

`swarm dry-run --bound 49` runs the matmul reference solver against a *synthetic*
bound-49 market and prints the complete, **spend-free** reveal plan — the
submission hash, the commitment hash, the canonical 97-byte `journal-v1`, and a
real seal fetched read-only from the mock verifier's `mockProve` view:

```
solver:  matmul-reference (Strassen⊗Strassen rank-49)
note:    rank-49 Strassen⊗Strassen, valid at bound 49 (49 products)
reveal plan (spend-free):
  submissionHash: 0x89c4…1ece
  commitmentHash: 0x2bc2…4b5f
  journal:        0x660d47e3…01   (image_id ‖ paramsHash ‖ submissionHash ‖ verdict=01)
  seal:           0xffffffff…      (36 bytes, RiscZeroMockVerifier)
```

`swarm dry-run --bound 46` (the flagship bound) correctly produces **no
submission** — the rank-49 reference scheme does not beat 46. Beating 46 is the
*open research problem* the flagship market prices; the reference solver does not
claim to solve it.

## Architecture

```
                      ┌──────────────────────────────────────────┐
   devnet RPC  ◀──────│ MarketClient   watchMarkets() scans       │
 (viem, 31337)        │                CapabilityMarket on-chain  │
                      └──────────────┬───────────────────────────┘
                                     │ Market {imageId, params, phase, pools…}
                                     ▼
                      ┌──────────────────────────────────────────┐
                      │ SolverRegistry — dispatch by imageId      │
                      │   • MatmulReferenceSolver  (real)         │
                      │   • LlmSolver              (stub)         │
                      └──────────────┬───────────────────────────┘
                                     │ Submission {bytes, submissionHash}
                                     ▼
                      ┌──────────────────────────────────────────┐
                      │ RevealPipeline  commit → prove → reveal   │
                      │   Uploader (Arweave)   • Null (dry-run)   │
                      │                        • Client (stub)    │
                      │   Prover               • MockDev (real*)  │
                      │                        • Groth16 (stub)   │
                      │   GasStrategy          • DirectNative     │
                      │                        • BundlerDvm (stub)│
                      └──────────────────────────────────────────┘
        * MockDev is real plumbing but carries NO cryptographic soundness.
```

The whole thing is driven by `SwarmDaemon.tick()`: discover actionable markets,
dispatch each to its solver, and either dry-run the reveal plan (default) or —
behind the explicit `--submit` gate — run the live commit/reveal.

### Reveal shape (what the pipeline wires end to end)

1. **solve** — the solver returns raw `<predicate>-submission-v1` bytes;
   `submissionHash = sha256(submission)` becomes the on-chain `solutionHash`.
2. **upload** — submission bytes go to Arweave; the `arweaveTx` id is bound into
   the commitment. (Dry-run uploads nothing → `arweaveTx = 0x00…`.)
3. **commit** — `commitmentHash = keccak256(abi.encodePacked(solutionHash,
   arweaveTx, minerAddr, salt))`. The miner address in the preimage is the
   commit-reveal front-running defense.
4. **prove** — build the canonical 97-byte journal
   (`imageId ‖ sha256(params) ‖ submissionHash ‖ verdict`) and produce a seal the
   market's RISC Zero verifier accepts.
5. **reveal** — `reveal(marketId, solutionHash, arweaveTx, salt, proof, journal)`.

## v0 scope — what's real vs stubbed

| Area | Status | Notes |
|------|--------|-------|
| **Market discovery** | ✅ real | On-chain scan of `CapabilityMarket` via viem — `marketCount()` + `getMarket(i)`, phase derived from timestamps. Runs against devnet. |
| **Matmul reference solver** | ✅ real | Faithful TS port of the capability-market matmul predicate: constructs the known rank-49 Strassen⊗Strassen scheme and self-verifies it (symbolic GF(2) identity check) before spending. |
| **Reveal plumbing** | ✅ real | commitment hash, `journal-v1` encoding, salt, arweaveTx binding, and the viem `commit`/`reveal` calls are all wired. |
| **Mock-verifier proving** | ⚠️ real* | `MockDevProver` fetches an exact, verifier-accepted seal from the on-chain `mockProve` view. Genuine plumbing, **zero cryptographic soundness** — dev/mock market only. |
| **LLM solver** | 🔲 stub | `LlmSolver` scaffolds the interface (prompt → candidate → local-verify → retry). **No model is called.** This is the real research surface — the reason it's a "swarm." |
| **Real (Groth16) proving** | 🔲 stub | `Groth16Prover` throws with instructions. Needs the capability-market RISC Zero toolchain (r0vm 3.0.5, `encode_seal`) or Bonsai/Kalypso. |
| **Gas abstraction** | 🔲 stub | `DirectNativeGas` is the default (miner pays native gas). `BundlerDvmGas` ([#125][125]) is a stub. |
| **Relay-event discovery** | 🔲 future | v0 discovers markets by on-chain scan. Future: market announcements over the TOON relay (kind:10032-style), so clients discover without RPC-polling every id. |
| **Live spending** | 🔒 gated | Default is always dry-run. `commit`/`reveal` require `--submit` + `SWARM_MINER_KEY`. |

\* "real\*" = the code path executes and produces on-chain-valid artifacts, but
against the mock verifier only, which by design accepts any well-formed claim.

## Devnet

Facts are in [`deployments/devnet.json`](deployments/devnet.json) (mirrors
capability-market):

- RPC `https://evm-rpc.devnet.toonprotocol.dev` (anvil, chainId 31337)
- `marketReal` `0x46879970393eB1a4E55CE868b77BD59DEfAEF459` (Groth16 verifier)
- `marketMock` `0xd1aAc47737FdF1bb124121CE8eF0bee47dEd9AeA` (mock verifier)
- USDC `0x5FbDB2315678afecb367f032d93F642f64180aa3` (6 decimals)

Fund a miner key (only needed for `--submit`):

```sh
curl -X POST https://faucet.devnet.toonprotocol.dev/api/request \
  -H 'content-type: application/json' -d '{"address":"0xYOURADDR"}'
```

## Development

```sh
npm run build   # tsc → dist/
npm test        # node:test (15 tests, no network)
npm run lint    # eslint
```

## License

MIT

[cm]: https://github.com/toon-protocol/capability-market
[client]: https://www.npmjs.com/package/@toon-protocol/client
[viem]: https://viem.sh
[84]: https://github.com/toon-protocol/toon-meta/issues/84
[119]: https://github.com/toon-protocol/toon-meta/issues/119
[120]: https://github.com/toon-protocol/toon-meta/issues/120
[121]: https://github.com/toon-protocol/toon-meta/issues/121
[#122]: https://github.com/toon-protocol/toon-meta/issues/122
[125]: https://github.com/toon-protocol/toon-meta/issues/125
