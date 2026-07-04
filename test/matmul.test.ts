import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToHex } from 'viem';
import {
  MatmulReferenceSolver,
  strassen4x4Rank49,
  verifyScheme,
  encodeScheme,
  encodeMarketParams,
  encodeMatmulManifest,
  marketParamsHash,
  FLAGSHIP_RANK_BOUND,
  FLAGSHIP_FROZEN_CLOCK,
} from '../src/solver/matmul.ts';
import { demoMatmulMarket } from '../src/demo.ts';

test('reference scheme has 49 products and verifies at bound 49', () => {
  const s = strassen4x4Rank49();
  assert.equal(s.length, 49);
  assert.equal(verifyScheme(s, 49), null); // valid
});

test('reference scheme fails the flagship bound 46 (the open problem)', () => {
  const s = strassen4x4Rank49();
  const reject = verifyScheme(s, FLAGSHIP_RANK_BOUND);
  assert.deepEqual(reject, { kind: 'RankExceeded', rank: 49, bound: 46 });
});

test('a flipped coefficient breaks the polynomial identity', () => {
  const s = strassen4x4Rank49();
  s[0]!.u ^= 1 << 3;
  const reject = verifyScheme(s, 49);
  assert.equal(reject?.kind, 'NotMatmul');
});

test('submission encoding is 6 bytes per triple', () => {
  const bytes = encodeScheme(strassen4x4Rank49());
  assert.equal(bytes.length, 49 * 6);
});

test('market-params encoding is a 32-byte big-endian bound', () => {
  const p = encodeMarketParams(46);
  assert.equal(p.length, 32);
  assert.deepEqual([...p.slice(28)], [0, 0, 0, 46]);
  assert.ok(p.slice(0, 28).every((b) => b === 0));
});

test('solver produces a winning submission at bound 49', async () => {
  const solver = new MatmulReferenceSolver([49]);
  const sub = await solver.solve(demoMatmulMarket(49));
  assert.ok(sub, 'expected a submission');
  assert.equal(sub!.submission.length, 49 * 6);
  assert.match(sub!.submissionHash, /^0x[0-9a-f]{64}$/);
});

test('solver correctly declines the flagship bound 46', async () => {
  const solver = new MatmulReferenceSolver([FLAGSHIP_RANK_BOUND]);
  const sub = await solver.solve(demoMatmulMarket(FLAGSHIP_RANK_BOUND));
  assert.equal(sub, null);
});

test('solver declines when the params preimage (bound) is unknown', async () => {
  const solver = new MatmulReferenceSolver([]); // no bounds registered
  const sub = await solver.solve(demoMatmulMarket(49));
  assert.equal(sub, null);
});

test('marketParamsHash matches the demo market struct', () => {
  const m = demoMatmulMarket(49);
  assert.equal(m.marketParamsHash, marketParamsHash(49));
});

// Byte-for-byte cross-check of the manifest-v1 encoder against capability-market's
// Rust `manifest` crate (toon-meta#121). rank46 == the flagship golden vector in
// predicates/crates/manifest/tests/golden_manifest_vectors.json + ARTIFACTS.json.
test('manifest-v1 encoding + sha256 match the Rust manifest crate (bounds 46 and 49)', () => {
  const golden = {
    46: {
      encoded:
        '0x544d46310300020c0066726f7a656e5f636c6f636b080000008085746700000000020d006d61726b65745f706172616d7320000000000000000000000000000000000000000000000000000000000000000000002e030a007375626d697373696f6e00000000',
      sha256: '0x0a029dce586c51f082c6b7e654926602e0602a3b32f7b3d11e9dd6c4cfa6ee0e',
    },
    49: {
      encoded:
        '0x544d46310300020c0066726f7a656e5f636c6f636b080000008085746700000000020d006d61726b65745f706172616d73200000000000000000000000000000000000000000000000000000000000000000000031030a007375626d697373696f6e00000000',
      sha256: '0x619ab7e84a9174861a1c608734b81b4faec3b9e6f695d0e42b23fcedd5b7d710',
    },
  } as const;
  for (const bound of [46, 49] as const) {
    assert.equal(bytesToHex(encodeMatmulManifest(bound, FLAGSHIP_FROZEN_CLOCK)), golden[bound].encoded);
    assert.equal(marketParamsHash(bound), golden[bound].sha256);
  }
});
