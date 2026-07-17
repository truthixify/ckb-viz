import type { AddressView } from '@/domain/address'
import type { SimulationResult } from '@/domain/simulation'
import type { Network, OutPoint, Transaction } from '@/domain/types'

/**
 * The single interface every backend hides behind (SPEC §6.1). A node, an
 * indexer, or the explorer API can implement it without the rest of the app
 * knowing who answers. `capabilities.forwardLineage` is the graceful-
 * degradation seam: the lineage view checks it before offering a forward step.
 */
export interface SourceCapabilities {
  /** Can this source find the transaction that consumed a given output? */
  forwardLineage: boolean
}

export interface TransactionSource {
  readonly network: Network
  readonly capabilities: SourceCapabilities

  /** Fetch and normalize a transaction by hash. Throws VizError on failure. */
  getTransaction(hash: string): Promise<Transaction>

  /**
   * Forward lineage: the hash of the transaction that consumed `outPoint`, or
   * null when no consuming transaction is found. Throws VizError('unsupported')
   * on a source that cannot look forward.
   */
  findConsumingTx(outPoint: OutPoint): Promise<string | null>

  /** The most recent transaction on this network, to open the tool on. */
  getLatestTransactionHash(): Promise<string | null>

  /** A recent real transaction of a curated kind (dao / token / …), or null. */
  findExampleTransaction(kindId: string): Promise<string | null>

  /** An address's holdings (CKB + tokens) and recent transactions. Throws
   *  VizError('unsupported') on a source that cannot resolve addresses. */
  getAddressView(address: string): Promise<AddressView>

  /** Simulate a raw transaction against current chain state (validity + cycles,
   *  or the failing script). Throws VizError('unsupported') on a bare source. */
  simulateTransaction(rawTx: unknown): Promise<SimulationResult>

  /** A real pending transaction's raw JSON to prefill the simulator, or null. */
  getSimulationExample(): Promise<string | null>
}
