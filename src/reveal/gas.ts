/**
 * Gas-payment strategy for reveal (and other) transactions.
 *
 * v0 default is {@link DirectNativeGas}: the miner signs and pays gas in the
 * chain's native token from its own funded key.
 *
 * The gas-abstracted path — a miner with no native gas submitting reveals and
 * paying in any TOON-supported token via a bundler/paymaster DVM — is
 * toon-meta#125, a separate umbrella. It is NOT built here; {@link BundlerDvmGas}
 * is a stub behind the same interface.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** A contract write the gas strategy is asked to land on-chain. */
export interface PreparedCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

export interface GasStrategy {
  readonly name: string;
  /** The address whose reveal this is (baked into commitments). */
  readonly miner: Address;
  /** Submit the call, resolving to the transaction hash. */
  submit(call: PreparedCall): Promise<Hex>;
}

/** Default: miner pays native gas from its own key. */
export class DirectNativeGas implements GasStrategy {
  readonly name = 'direct-native';
  readonly miner: Address;
  private readonly wallet: ReturnType<typeof createWalletClient>;
  private readonly publicClient: ReturnType<typeof createPublicClient>;

  constructor(opts: { rpcUrl: string; privateKey: Hex }) {
    const account = privateKeyToAccount(opts.privateKey);
    this.miner = account.address;
    const transport = http(opts.rpcUrl);
    this.wallet = createWalletClient({ account, transport });
    this.publicClient = createPublicClient({ transport });
  }

  async submit(call: PreparedCall): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account: this.wallet.account,
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    });
    return this.wallet.writeContract(request);
  }
}

export class GasStrategyNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GasStrategyNotImplementedError';
  }
}

/**
 * Gas-abstracted submission via a bundler/paymaster DVM (toon-meta#125). STUB.
 * The miner would hand a signed UserOp-style intent to a DVM that lands the
 * transaction and charges the miner in any TOON-supported token. Not built.
 */
export class BundlerDvmGas implements GasStrategy {
  readonly name = 'bundler-dvm (NOT IMPLEMENTED)';
  constructor(readonly miner: Address) {}

  async submit(_call: PreparedCall): Promise<Hex> {
    throw new GasStrategyNotImplementedError(
      'Bundler-DVM gas abstraction is not built in v0 (toon-meta#125). Use ' +
        'DirectNativeGas with a funded miner key.',
    );
  }
}
