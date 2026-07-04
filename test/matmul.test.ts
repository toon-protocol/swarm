import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MatmulReferenceSolver,
  strassen4x4Rank49,
  verifyScheme,
  encodeScheme,
  encodeMarketParams,
  marketParamsHash,
  FLAGSHIP_RANK_BOUND,
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
