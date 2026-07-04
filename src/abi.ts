/**
 * Minimal `CapabilityMarket.sol` ABI — the surface the miner touches.
 *
 * Source of truth: toon-protocol/capability-market
 * `contracts/src/CapabilityMarket.sol` (spec toon-meta#120). Keep in sync with
 * that contract; only the functions/events/errors the swarm client calls are
 * mirrored here.
 */
export const capabilityMarketAbi = [
  // ---- views ----
  {
    type: 'function',
    name: 'marketCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'verifier',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getMarket',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'imageId', type: 'bytes32' },
          { name: 'predicateArweaveTx', type: 'bytes32' },
          { name: 'marketParamsHash', type: 'bytes32' },
          { name: 'deadline', type: 'uint256' },
          { name: 'commitRevealWindow', type: 'uint256' },
          { name: 'lockWindowEnd', type: 'uint256' },
          { name: 'resolutionBountyBps', type: 'uint256' },
          { name: 'yesPool', type: 'uint256' },
          { name: 'noPool', type: 'uint256' },
          { name: 'resolution', type: 'uint8' },
          { name: 'winner', type: 'address' },
          { name: 'bountyPaid', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getCommitment',
    stateMutability: 'view',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'committer', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'commitmentHash', type: 'bytes32' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
  },
  // ---- writes ----
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'commit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'commitmentHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'reveal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'solutionHash', type: 'bytes32' },
      { name: 'arweaveTx', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
      { name: 'journal', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'settleTimeout',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
  },
  // ---- events (used for discovery / progress) ----
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { name: 'marketId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'imageId', type: 'bytes32', indexed: false },
      { name: 'predicateArweaveTx', type: 'bytes32', indexed: false },
      { name: 'marketParamsHash', type: 'bytes32', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
      { name: 'commitRevealWindow', type: 'uint256', indexed: false },
      { name: 'lockWindowEnd', type: 'uint256', indexed: false },
      { name: 'resolutionBountyBps', type: 'uint256', indexed: false },
      { name: 'seedNoStake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Revealed',
    inputs: [
      { name: 'marketId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'solutionHash', type: 'bytes32', indexed: false },
      { name: 'arweaveTx', type: 'bytes32', indexed: false },
    ],
  },
] as const;
