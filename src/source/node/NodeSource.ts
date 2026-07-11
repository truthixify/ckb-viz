import {
  ClientPublicMainnet,
  ClientPublicTestnet,
  type Client,
  type OutPoint as CccOutPoint,
  type Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { EXAMPLE_KINDS, exampleSearch } from '@/app/examples'
import { VizError } from '@/domain/errors'
import type { Cell, Network, OutPoint, Transaction } from '@/domain/types'
import type { SourceCapabilities, TransactionSource } from '../TransactionSource'
import { cellFromCcc, normalizeTransaction } from './normalize'

/** Bound the input-resolution fan-out so a large tx can't hammer the endpoint. */
const RESOLVE_CONCURRENCY = 8
/** How far back to look for the consuming tx among a lock's spending txs. */
const FORWARD_SCAN_LIMIT = 40
/** How many blocks down from the tip to scan for the latest transaction. */
const LATEST_SCAN_DEPTH = 30n

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
  readonly capabilities: SourceCapabilities = { forwardLineage: true }
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

    return normalizeTransaction(
      hash,
      tx,
      resp,
      inputCells,
      header ?? undefined,
      this.network,
      this.client.addressPrefix,
    )
  }

  /**
   * The network's latest transaction: scan blocks down from the tip for the
   * first with a non-cellbase transaction and return its most recent one. (The
   * indexer can't answer "latest overall" — a prefix search orders by script,
   * not block.) Falls back to the tip block's cellbase.
   */
  async getLatestTransactionHash(): Promise<string | null> {
    let tip: bigint
    try {
      tip = await this.client.getTip()
    } catch (error) {
      throw new VizError(
        'network',
        'Could not reach the node',
        error instanceof Error ? error.message : undefined,
      )
    }
    for (let i = 0n; i < LATEST_SCAN_DEPTH; i++) {
      const block = await this.client.getBlockByNumber(tip - i)
      if (block && block.transactions.length > 1) {
        const tx = block.transactions[block.transactions.length - 1]
        if (tx) return tx.hash()
      }
    }
    const tipBlock = await this.client.getBlockByNumber(tip)
    return tipBlock?.transactions[0]?.hash() ?? null
  }

  async findExampleTransaction(kindId: string): Promise<string | null> {
    const kind = EXAMPLE_KINDS.find((k) => k.id === kindId)
    if (!kind) return null
    const search = exampleSearch(kind, this.network)
    if (!search) return null
    const key = { ...search, scriptSearchMode: 'exact' as const }
    try {
      for await (const record of this.client.findTransactions(key, 'desc', 1)) {
        return record.txHash
      }
    } catch {
      return null
    }
    return null
  }

  /**
   * Forward lineage via the built-in indexer: resolve the output's lock, list
   * the transactions that spend that lock, and return the one whose input
   * references this exact out-point. Best-effort within a bounded scan.
   */
  async findConsumingTx(outPoint: OutPoint): Promise<string | null> {
    const source = await this.client.getTransaction(outPoint.txHash)
    const output = source?.transaction.outputs[outPoint.index]
    if (!output) return null

    const key = {
      script: output.lock,
      scriptType: 'lock' as const,
      scriptSearchMode: 'exact' as const,
    }
    try {
      for await (const record of this.client.findTransactions(key, 'desc', FORWARD_SCAN_LIMIT)) {
        if (!record.isInput || record.txHash === outPoint.txHash) continue
        const candidate = await this.client.getTransaction(record.txHash)
        const consumes = candidate?.transaction.inputs.some(
          (input) =>
            input.previousOutput.txHash === outPoint.txHash &&
            Number(input.previousOutput.index) === outPoint.index,
        )
        if (consumes) return record.txHash
      }
    } catch {
      return null
    }
    return null
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
    const prefix = this.client.addressPrefix
    try {
      const live = await this.client.getCellLive(outPoint, true)
      if (live) return cellFromCcc(live.cellOutput, live.outputData, location, prefix)

      // Spent or not live — fall back to the creating transaction's output.
      const prev = await this.client.getTransaction(outPoint.txHash)
      if (!prev) return undefined
      const output = prev.transaction.outputs[location.index]
      if (!output) return undefined
      return cellFromCcc(output, prev.transaction.outputsData[location.index] ?? '0x', location, prefix)
    } catch {
      return undefined
    }
  }
}
