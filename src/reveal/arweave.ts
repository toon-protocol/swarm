/**
 * Submission upload to Arweave.
 *
 * The reveal binds `arweaveTx` (bytes32) — the id of the Arweave record holding
 * the raw submission bytes — so a market can be audited after the fact. Upload
 * goes through the TOON store / Turbo path used elsewhere in the stack
 * (capability-market `e2e/upload-predicate.mjs`, and `@toon-protocol/client`'s
 * store/Turbo uploader).
 *
 * v0 ships {@link NullUploader} (dry-run: no upload, zero tx id) and
 * {@link ClientArweaveUploader}, a thin adapter over the optional
 * `@toon-protocol/client` dependency, loaded dynamically so the package builds
 * and runs read-only without it installed.
 */
import type { Hex } from 'viem';

export interface Uploader {
  readonly name: string;
  /** Upload bytes, resolving to the Arweave tx id (43-char base64url). */
  upload(bytes: Uint8Array, contentType?: string): Promise<string>;
}

/** Dry-run uploader: uploads nothing, yields an empty tx id (bytes32(0)). */
export class NullUploader implements Uploader {
  readonly name = 'null (dry-run — no upload)';
  async upload(): Promise<string> {
    return '';
  }
}

/**
 * Adapter over `@toon-protocol/client`'s Arweave upload (store/Turbo). Loaded
 * dynamically: `@toon-protocol/client` is an optional dependency so read-only
 * commands work without it.
 *
 * NOTE: the exact client upload entrypoint is intentionally not hard-wired in
 * v0 — the client's store/Turbo API surface is the integration seam. This
 * adapter documents the seam and fails loudly until wired.
 */
export class ClientArweaveUploader implements Uploader {
  readonly name = '@toon-protocol/client (store/Turbo)';

  async upload(_bytes: Uint8Array, _contentType?: string): Promise<string> {
    let client: unknown;
    try {
      client = await import('@toon-protocol/client');
    } catch {
      throw new Error(
        'ClientArweaveUploader requires the optional @toon-protocol/client ' +
          'dependency. Install it, or supply a custom Uploader.',
      );
    }
    void client;
    throw new Error(
      'ClientArweaveUploader is not wired in v0: bind this to the ' +
        '@toon-protocol/client store/Turbo upload entrypoint (the same path ' +
        'capability-market e2e/upload-predicate.mjs uses). See README scope table.',
    );
  }
}

/** A resolved upload: the tx id and its bytes32 form for the reveal. */
export interface UploadResult {
  txId: string;
  arweaveTx: Hex;
}
