import {
  ClientPublicMainnet,
  ClientPublicTestnet,
  type Client,
  type OutPoint as CccOutPoint,
  type Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { VizError } from '@/domain/errors'
import type { Cell, Network, OutPoint, Transaction } from '@/domain/types'
import type { SourceCapabilities, TransactionSource } from '../TransactionSource'
import { cellFromCcc, normalizeTransaction } from './normalize'

/** Bound the input-resolution fan-out so a large tx can't hammer the endpoint. */
const RESOLVE_CONCURRENCY = 8

/**
 * A live CKB node source over @ckb-ccc/core (SPEC §6.2-6.3). Fetches a
 * transaction, resolves each input's previous output (get_live_cell, falling
 * back to get_transaction on a spent cell), and reads the header for the
 * timestamp. A bare node cannot look forward from a cell, so forward lineage
 * degrades gracefully — the capability is off and findConsumingTx is
 * unsupported (SPEC §6.4).
 */
export class NodeSource implements TransactionSource {
  readonly network: Network
  readonly capabilities: SourceCapabilities = { forwardLineage: false }
  private readonly client: Client

  constructor(network: Network, rpcUrl: string) {
    this.network = network
    this.client =
      network === 'mainnet'
        ? new ClientPublicMainnet({ url: rpcUrl })
        : new ClientPublicTestnet({ url: rpcUrl })
  }

  async getTransaction(hash: string): Promise<Transaction> {
    let resp
    try {
      resp = await this.client.getTransaction(hash)
    } catch (error) {
      throw new VizError(
        'network',
        'Could not reach the node',
        error instanceof Error ? error.message : undefined,
      )
    }
    if (!resp || resp.status === 'unknown') {
      throw new VizError('not-found', 'Transaction not found on this network')
    }

    const tx = resp.transaction
    const inputCells = await this.resolveInputs(tx)

    let header
    if (resp.blockNumber != null) {
      try {
        header = await this.client.getHeaderByNumber(resp.blockNumber)
      } catch {
        header = undefined
      }
    }

    return normalizeTransaction(hash, tx, resp, inputCells, header ?? undefined, this.network)
  }

  findConsumingTx(_outPoint: OutPoint): Promise<string | null> {
    return Promise.reject(
      new VizError('unsupported', 'Forward lineage needs an indexer or explorer source'),
    )
  }

  private async resolveInputs(tx: CccTransaction): Promise<(Cell | undefined)[]> {
    const results: (Cell | undefined)[] = new Array(tx.inputs.length)
    let cursor = 0
    const worker = async () => {
      while (cursor < tx.inputs.length) {
        const i = cursor++
        const input = tx.inputs[i]
        if (input) results[i] = await this.resolveOne(input.previousOutput)
      }
    }
    const workers = Array.from({ length: Math.min(RESOLVE_CONCURRENCY, tx.inputs.length) }, worker)
    await Promise.all(workers)
    return results
  }

  private async resolveOne(outPoint: CccOutPoint): Promise<Cell | undefined> {
    const location = { txHash: outPoint.txHash, index: Number(outPoint.index) }
    try {
      const live = await this.client.getCellLive(outPoint, true)
      if (live) return cellFromCcc(live.cellOutput, live.outputData, location)

      // Spent or not live — fall back to the creating transaction's output.
      const prev = await this.client.getTransaction(outPoint.txHash)
      if (!prev) return undefined
      const output = prev.transaction.outputs[location.index]
      if (!output) return undefined
      return cellFromCcc(output, prev.transaction.outputsData[location.index] ?? '0x', location)
    } catch {
      return undefined
    }
  }
}
