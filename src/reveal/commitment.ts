/**
 * Commit-reveal front-running defense (toon-meta#84 decided fork).
 *
 * commitmentHash = keccak256(abi.encodePacked(solutionHash, arweaveTx,
 *                            minerAddr, salt))
 *
 * The miner address is baked into the preimage, so a mempool bot replaying the
 * reveal calldata from its own address cannot match the commitment.
 */
import {
  encodePacked,
  keccak256,
  bytesToHex,
  type Address,
  type Hex,
} from 'viem';
import { randomBytes } from 'node:crypto';

/** Compute the on-chain commitment hash for a reveal. */
export function computeCommitment(args: {
  solutionHash: Hex;
  arweaveTx: Hex;
  miner: Address;
  salt: Hex;
}): Hex {
  return keccak256(
    encodePacked(
      ['bytes32', 'bytes32', 'address', 'bytes32'],
      [args.solutionHash, args.arweaveTx, args.miner, args.salt],
    ),
  );
}

/** Fresh 32-byte salt. */
export function randomSalt(): Hex {
  return bytesToHex(randomBytes(32));
}

/**
 * Convert an Arweave transaction id (43-char base64url, 32 raw bytes) to the
 * `bytes32` the contract stores. A zero/empty id maps to bytes32(0) — used in
 * dry-runs before a real upload exists.
 */
export function arweaveTxToBytes32(txId: string | undefined): Hex {
  if (!txId) return `0x${'00'.repeat(32)}`;
  const b64 = txId.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `arweave tx id must decode to 32 bytes, got ${buf.length} from "${txId}"`,
    );
  }
  return bytesToHex(buf);
}
