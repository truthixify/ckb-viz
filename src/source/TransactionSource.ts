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
   * null when the output is still live. Throws VizError('unsupported') on a
   * source that cannot look forward (a bare node).
   */
  findConsumingTx(outPoint: OutPoint): Promise<string | null>
}
