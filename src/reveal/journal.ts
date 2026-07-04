/**
 * Canonical capability-market journal (`journal-v1`, toon-meta#121).
 *
 * 97 tightly packed bytes: image_id(32) ‖ market_params_hash(32) ‖
 * submission_hash(32) ‖ verdict(1). This is a faithful port of
 * capability-market `predicates/crates/journal`. `CapabilityMarket.reveal`
 * decodes exactly these bytes and requires them to match the market fields.
 *
 * The miner can assemble the journal WITHOUT running the guest: every field is
 * known off-chain — image_id and market_params_hash come from the market, the
 * submission_hash is `sha256(submission)`, and a revealed submission is by
 * definition verdict=true. The prover's job is to produce the matching *seal*;
 * the journal bytes themselves are deterministic.
 */
import { concatHex, type Hex } from 'viem';

export const JOURNAL_LENGTH = 97;

export interface JournalFields {
  imageId: Hex;
  marketParamsHash: Hex;
  submissionHash: Hex;
  verdict: boolean;
}

/** Encode the 97-byte `journal-v1` layout. */
export function encodeJournal(j: JournalFields): Hex {
  const verdictByte: Hex = j.verdict ? '0x01' : '0x00';
  return concatHex([j.imageId, j.marketParamsHash, j.submissionHash, verdictByte]);
}
