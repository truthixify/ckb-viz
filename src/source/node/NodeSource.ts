import {
  Address,
  ClientPublicMainnet,
  ClientPublicTestnet,
  calcDaoProfit,
  type Client,
  type OutPoint as CccOutPoint,
  type Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { EXAMPLE_KINDS, exampleSearch } from '@/app/examples'
import type { AddressView, TokenHolding } from '@/domain/address'
import { decodeDaoCell } from '@/decode/dao'
import { isUdtType } from '@/decode/data'
import { byteLength } from '@/domain/hex'
import { lookupToken } from '@/decode/tokens'
import { decodeUdtAmount } from '@/decode/udt'
import { VizError } from '@/domain/errors'
import { parseSimulationError, splitOutPoint, type SimulationResult } from '@/domain/simulation'
import type { Cell, Network, OutPoint, Transaction } from '@/domain/types'
import { deploymentFor } from '@/registry/codeHashes'
import { ScriptRegistry } from '@/registry/registry'
import type { SourceCapabilities, TransactionSource } from '../TransactionSource'
import {
  cellFromCcc,
  normalizeRawTransaction,
  normalizeTransaction,
  parseRawRpcTransaction,
  scriptFromCcc,
} from './normalize'

/** Bound the input-resolution fan-out so a large tx can't hammer the endpoint. */
const RESOLVE_CONCURRENCY = 8
/** How far back to look for the consuming tx among a lock's spending txs. */
const FORWARD_SCAN_LIMIT = 40
/** How many blocks down from the tip to scan for the latest transaction. */
const LATEST_SCAN_DEPTH = 30n
/** Cap the live-cell scan for token balances (CKB balance stays exact). */
const ADDRESS_CELL_CAP = 500
/** How many recent transactions to list for an address. */
const ADDRESS_TX_LIMIT = 25

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
  private readonly rpcUrl: string

  constructor(network: Network, rpcUrl: string) {
    this.network = network
    this.rpcUrl = rpcUrl
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

    const normalized = normalizeTransaction(
      hash,
      tx,
      resp,
      inputCells,
      header ?? undefined,
      this.network,
      this.client.addressPrefix,
    )
    await this.applyDaoCompensation(normalized)
    return normalized
  }

  /**
   * A Nervos DAO withdrawal releases the deposit plus compensation, so the
   * outputs exceed the inputs and the raw fee = in − out is negative. Compute
   * the compensation from the deposit and withdraw block headers (RFC0023) and
   * correct the fee to the real (tiny) one, exposing the interest separately.
   */
  private async applyDaoCompensation(tx: Transaction): Promise<void> {
    const daoCodeHash = deploymentFor('nervosDao', this.network)?.codeHash.toLowerCase()
    if (!daoCodeHash) return

    let compensation = 0n
    for (const input of tx.inputs) {
      const cell = input.cell
      if (!cell || cell.type?.codeHash.toLowerCase() !== daoCodeHash) continue
      const dao = decodeDaoCell(cell.data)
      if (!dao || dao.phase !== 'withdraw' || dao.depositBlock === null) continue
      try {
        const creator = await this.client.getTransaction(input.outPoint.txHash)
        const withdrawBlock = creator?.blockNumber
        if (withdrawBlock == null) continue
        const [depositHeader, withdrawHeader] = await Promise.all([
          this.client.getHeaderByNumber(dao.depositBlock),
          this.client.getHeaderByNumber(withdrawBlock),
        ])
        if (!depositHeader || !withdrawHeader) continue
        const profitable = cell.capacity - cell.occupiedCapacity
        compensation += calcDaoProfit(profitable, depositHeader, withdrawHeader)
      } catch {
        // skip an input we can't price
      }
    }

    if (compensation > 0n) {
      tx.daoCompensation = compensation
      if (tx.fee !== undefined) tx.fee = tx.fee + compensation
    }
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
    const key = { ...search, scriptSearchMode: kind.searchMode }
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
   * Resolve an address to its lock, then read its holdings and recent txs from
   * the indexer. The CKB balance is exact (one `get_cells_capacity` call); token
   * balances are summed from a bounded live-cell scan, flagged when capped.
   */
  async getAddressView(address: string): Promise<AddressView> {
    let parsed: Address
    try {
      parsed = await Address.fromString(address, this.client)
    } catch {
      const expected = address.trim().toLowerCase().startsWith('ckt') ? 'testnet' : 'mainnet'
      throw new VizError(
        'invalid-address',
        'Invalid address',
        this.network === expected
          ? 'This does not decode as a valid CKB address.'
          : `This is a ${expected} address, but the ${this.network} network is selected.`,
      )
    }
    const lockScript = parsed.script
    const key = { script: lockScript, scriptType: 'lock' as const, scriptSearchMode: 'exact' as const }
    const registry = new ScriptRegistry(this.network)
    const lock = registry.annotate(scriptFromCcc(lockScript))

    let ckbBalance = 0n
    try {
      ckbBalance = await this.client.getCellsCapacity(key)
    } catch (error) {
      throw new VizError(
        'network',
        'Could not reach the node',
        error instanceof Error ? error.message : undefined,
      )
    }

    const tokenMap = new Map<string, TokenHolding>()
    let scannedCells = 0
    let capped = false
    try {
      for await (const cell of this.client.findCells(key, 'desc', 100)) {
        scannedCells++
        const cccType = cell.cellOutput.type
        if (cccType) {
          const type = scriptFromCcc(cccType)
          // A fungible-token cell is a known UDT, or any type-script cell whose
          // data is exactly a 16-byte little-endian amount — so tokens whose
          // code hash we don't recognize still show (unnamed), like Etherscan.
          const isToken = isUdtType(this.network, type, registry) || byteLength(cell.outputData) === 16
          if (isToken) {
            const amount = decodeUdtAmount(cell.outputData) ?? 0n
            const id = `${type.codeHash}:${type.args}`.toLowerCase()
            const existing = tokenMap.get(id)
            if (existing) {
              existing.amount += amount
              existing.cellCount += 1
            } else {
              const info = lookupToken(this.network, type)
              const holding: TokenHolding = { type, amount, cellCount: 1 }
              if (info?.symbol) holding.symbol = info.symbol
              if (info?.name) holding.name = info.name
              if (info?.decimals !== undefined) holding.decimals = info.decimals
              tokenMap.set(id, holding)
            }
          }
        }
        if (scannedCells >= ADDRESS_CELL_CAP) {
          capped = true
          break
        }
      }
    } catch {
      // partial token balances are still worth showing; CKB balance is exact
    }

    const recentTxs: { hash: string; blockNumber: bigint }[] = []
    try {
      for await (const record of this.client.findTransactionsByLock(lockScript, null, true, 'desc', 25)) {
        recentTxs.push({ hash: record.txHash, blockNumber: record.blockNumber })
        if (recentTxs.length >= ADDRESS_TX_LIMIT) break
      }
    } catch {
      // recent txs are best-effort
    }

    const tokens = [...tokenMap.values()]
      .filter((t) => t.amount > 0n)
      .sort((a, b) => (a.symbol ? -1 : 1) - (b.symbol ? -1 : 1))

    return {
      holdings: {
        address,
        network: this.network,
        lock,
        ckbBalance,
        scannedCells,
        capped,
        tokens,
      },
      recentTxs,
    }
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

  private resolveOne(outPoint: CccOutPoint): Promise<Cell | undefined> {
    return this.resolveByLocation(outPoint.txHash, Number(outPoint.index))
  }

  private async resolveByLocation(txHash: string, index: number): Promise<Cell | undefined> {
    const location = { txHash, index }
    const prefix = this.client.addressPrefix
    try {
      const live = await this.client.getCellLive({ txHash, index: BigInt(index) }, true)
      if (live) return cellFromCcc(live.cellOutput, live.outputData, location, prefix)

      // Spent or not live — fall back to the creating transaction's output.
      const prev = await this.client.getTransaction(txHash)
      if (!prev) return undefined
      const output = prev.transaction.outputs[index]
      if (!output) return undefined
      return cellFromCcc(output, prev.transaction.outputsData[index] ?? '0x', location, prefix)
    } catch {
      return undefined
    }
  }

  /** Raw JSON-RPC call for methods CCC does not type (test_tx_pool_accept). */
  private async rawRpc(method: string, params: unknown[]): Promise<{ result?: unknown; error?: { message?: string } }> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    })
    return res.json() as Promise<{ result?: unknown; error?: { message?: string } }>
  }

  /**
   * Simulate a raw transaction against current chain state (SPEC: CKB has no
   * on-chain failed txs, so validity is answered by running it). Resolves inputs
   * and normalizes for the flow, then runs estimate_cycles — which executes
   * every lock and type script and returns the cycles, or the failing script /
   * exit code on error.
   */
  async simulateTransaction(rawInput: unknown): Promise<SimulationResult> {
    const raw = parseRawRpcTransaction(rawInput)
    const inputCells = await Promise.all(
      raw.inputs.map((i) =>
        this.resolveByLocation(i.previous_output.tx_hash, Number(BigInt(i.previous_output.index))),
      ),
    )
    const transaction = normalizeRawTransaction(raw, inputCells, this.network)
    const fee = transaction.fee

    const txForRpc = {
      version: raw.version ?? '0x0',
      cell_deps: raw.cell_deps,
      header_deps: raw.header_deps,
      inputs: raw.inputs,
      outputs: raw.outputs,
      outputs_data: raw.outputs_data,
      witnesses: raw.witnesses,
    }

    let response
    try {
      response = await this.rawRpc('estimate_cycles', [txForRpc])
    } catch (error) {
      throw new VizError(
        'network',
        'Could not reach the node to simulate',
        error instanceof Error ? error.message : undefined,
      )
    }

    if (response.error) {
      const message = response.error.message ?? JSON.stringify(response.error)
      const error = parseSimulationError(message)
      // A resolve failure usually means an input is already spent. Find what
      // spent it — often this very transaction, now committed on-chain — so the
      // verdict can say so and link there.
      if (error.kind === 'resolve' && error.outPoint) {
        const op = splitOutPoint(error.outPoint)
        if (op) {
          try {
            const consumer = await this.findConsumingTx(op)
            if (consumer) {
              error.consumedBy = consumer
              error.headline = 'This input is already spent — the transaction is likely already on-chain.'
            }
          } catch {
            // keep the generic resolve message
          }
        }
      }
      return { verdict: 'invalid', error, transaction, ...(fee !== undefined ? { fee } : {}) }
    }

    const cycles = BigInt((response.result as { cycles: string }).cycles)
    return { verdict: 'valid', cycles, transaction, ...(fee !== undefined ? { fee } : {}) }
  }

  /** A real pending transaction's raw JSON, to prefill the simulator. Null when
   *  the mempool is empty (CKB traffic is low, so this can happen). */
  async getSimulationExample(): Promise<string | null> {
    try {
      const pool = await this.rawRpc('get_raw_tx_pool', [])
      const ids = pool.result as { pending?: string[]; proposed?: string[] } | undefined
      const hash = ids?.pending?.[0] ?? ids?.proposed?.[0]
      if (!hash) return null
      const resp = await this.rawRpc('get_transaction', [hash])
      const tx = (resp.result as { transaction?: Record<string, unknown> } | undefined)?.transaction
      if (!tx) return null
      delete tx.hash
      return JSON.stringify(tx, null, 2)
    } catch {
      return null
    }
  }
}
