import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCommitment, arweaveTxToBytes32, randomSalt } from '../src/reveal/commitment.ts';
import { encodeJournal, JOURNAL_LENGTH } from '../src/reveal/journal.ts';
import { derivePhase, Resolution } from '../src/market/types.ts';

const SOL_HASH = ('0x' + '11'.repeat(32)) as `0x${string}`;
const MINER = '0x00000000000000000000000000000000000000aa' as `0x${string}`;

test('commitment hash is deterministic and address-bound', () => {
  const salt = ('0x' + '22'.repeat(32)) as `0x${string}`;
  const arweaveTx = arweaveTxToBytes32(undefined);
  const a = computeCommitment({ solutionHash: SOL_HASH, arweaveTx, miner: MINER, salt });
  const b = computeCommitment({ solutionHash: SOL_HASH, arweaveTx, miner: MINER, salt });
  assert.equal(a, b, 'same inputs → same commitment');

  const other = '0x00000000000000000000000000000000000000bb' as `0x${string}`;
  const c = computeCommitment({ solutionHash: SOL_HASH, arweaveTx, miner: other, salt });
  assert.notEqual(a, c, 'different miner → different commitment (front-run defense)');
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test('randomSalt yields distinct 32-byte values', () => {
  assert.notEqual(randomSalt(), randomSalt());
});

test('empty arweave id maps to bytes32(0)', () => {
  assert.equal(arweaveTxToBytes32(undefined), '0x' + '00'.repeat(32));
});

test('a 43-char base64url arweave id decodes to a bytes32', () => {
  // 32 bytes of 0xAB → base64url
  const id = Buffer.alloc(32, 0xab).toString('base64url');
  const hex = arweaveTxToBytes32(id);
  assert.equal(hex, '0x' + 'ab'.repeat(32));
});

test('journal encodes to exactly 97 bytes', () => {
  const j = encodeJournal({
    imageId: ('0x' + '01'.repeat(32)) as `0x${string}`,
    marketParamsHash: ('0x' + '02'.repeat(32)) as `0x${string}`,
    submissionHash: ('0x' + '03'.repeat(32)) as `0x${string}`,
    verdict: true,
  });
  assert.equal((j.length - 2) / 2, JOURNAL_LENGTH);
  assert.ok(j.endsWith('01'), 'verdict byte true = 0x01');
});

test('phase derivation walks staking → commit → reveal → timeout', () => {
  const base = { lockWindowEnd: 100n, deadline: 200n, commitRevealWindow: 50n, resolution: Resolution.Unresolved };
  assert.equal(derivePhase(base, 50n), 'staking');
  assert.equal(derivePhase(base, 150n), 'commit');
  assert.equal(derivePhase(base, 220n), 'reveal');
  assert.equal(derivePhase(base, 300n), 'timeout-open');
  assert.equal(derivePhase({ ...base, resolution: Resolution.ResolvedYes }, 150n), 'resolved');
});
