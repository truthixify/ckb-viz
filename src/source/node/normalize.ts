import {
  Address,
  type CellOutput as CccCellOutput,
  type ClientBlockHeader,
  type ClientTransactionResponse,
  type Script as CccScript,
  type Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { occupiedCapacity } from '@/domain/capacity'
import { VizError } from '@/domain/errors'
import type { Cell, CellDep, HashType, Input, Network, Script, Transaction, TxStatus } from '@/domain/types'
import { decodeSince } from '@/decode/since'

/**
 * Normalize CCC entities (camelCase, bigint amounts) into the SPEC §5 model.
 * The source produces this raw-normalized shape; the registry and decoder
 * enrich it downstream.
 */
export function scriptFromCcc(s: CccScript): Script {
  return { codeHash: s.codeHash, hashType: s.hashType, args: s.args }
}

export function cellFromCcc(
  out: CccCellOutput,
  dataHex: string,
  outPoint: { txHash: string; index: number },
  addressPrefix: string,
): Cell {
  const lock = scriptFromCcc(out.lock)
  try {
    lock.address = new Address(out.lock, addressPrefix).toString()
  } catch {
    // leave the address unset if encoding fails
  }
  const type = out.type ? scriptFromCcc(out.type) : undefined
  const data = dataHex || '0x'
  const cell: Cell = {
    capacity: out.capacity,
    occupiedCapacity: occupiedCapacity(lock, type, data),
    lock,
    data,
    outPoint,
  }
  if (type) cell.type = type
  return cell
}

function mapStatus(status: string): TxStatus {
  return status === 'sent' ? 'pending' : (status as TxStatus)
}

export function normalizeTransaction(
  hash: string,
  tx: CccTransaction,
  resp: ClientTransactionResponse,
  inputCells: (Cell | undefined)[],
  header: ClientBlockHeader | undefined,
  network: Network,
  addressPrefix: string,
): Transaction {
  const inputs: Input[] = tx.inputs.map((inp, i) => {
    const outPoint = { txHash: inp.previousOutput.txHash, index: Number(inp.previousOutput.index) }
    const base: Input = { outPoint, since: decodeSince(inp.since) }
    const cell = inputCells[i]
    if (cell) base.cell = cell
    return base
  })

  const outputs: Cell[] = tx.outputs.map((out, i) =>
    cellFromCcc(out, tx.outputsData[i] ?? '0x', { txHash: hash, index: i }, addressPrefix),
  )

  const cellDeps: CellDep[] = tx.cellDeps.map((d) => ({
    outPoint: { txHash: d.outPoint.txHash, index: Number(d.outPoint.index) },
    depType: d.depType === 'depGroup' ? 'depGroup' : 'code',
  }))

  const outputsTotal = outputs.reduce((a, c) => a + c.capacity, 0n)
  const allResolved = inputs.length > 0 && inputs.every((i) => i.cell)
  const inputsTotal = allResolved
    ? inputs.reduce((a, i) => a + (i.cell?.capacity ?? 0n), 0n)
    : undefined
  const fee = inputsTotal !== undefined ? inputsTotal - outputsTotal : undefined

  let size = 0
  try {
    size = tx.toBytes().length
  } catch {
    size = 0
  }

  const result: Transaction = {
    hash,
    network,
    status: mapStatus(resp.status),
    size,
    inputs,
    outputs,
    cellDeps,
    headerDeps: tx.headerDeps,
    witnesses: tx.witnesses,
  }
  if (resp.blockNumber != null) result.blockNumber = resp.blockNumber
  if (header) result.timestamp = Number(header.timestamp)
  if (resp.cycles != null) result.cyclesConsumed = resp.cycles
  if (fee !== undefined) result.fee = fee
  return result
}

/** A raw CKB JSON-RPC transaction object (snake_case, 0x-hex quantities). */
export interface RawRpcTransaction {
  version?: string
  cell_deps: { out_point: { tx_hash: string; index: string }; dep_type: string }[]
  header_deps: string[]
  inputs: { previous_output: { tx_hash: string; index: string }; since: string }[]
  outputs: { capacity: string; lock: RawRpcScript; type?: RawRpcScript | null }[]
  outputs_data: string[]
  witnesses: string[]
}
interface RawRpcScript {
  code_hash: string
  hash_type: string
  args: string
}

/** Validate an arbitrary parsed value as a raw RPC transaction, throwing a
 *  plain-language VizError('malformed') when it isn't shaped like one. */
export function parseRawRpcTransaction(input: unknown): RawRpcTransaction {
  const bad = (why: string): never => {
    throw new VizError('malformed', why)
  }
  if (typeof input !== 'object' || input === null) bad('Not a JSON object.')
  const obj = input as Record<string, unknown>
  // A get_transaction result nests the tx under `transaction`; accept either.
  const tx = (obj.transaction && typeof obj.transaction === 'object' ? obj.transaction : obj) as Record<
    string,
    unknown
  >
  for (const field of ['inputs', 'outputs', 'outputs_data', 'cell_deps', 'witnesses']) {
    if (!Array.isArray(tx[field])) bad(`Missing or invalid "${field}" array.`)
  }
  if (!Array.isArray(tx.header_deps)) tx.header_deps = []
  return tx as unknown as RawRpcTransaction
}

const HASH_TYPES: HashType[] = ['data', 'type', 'data1', 'data2']
function hashType(value: string): HashType {
  return (HASH_TYPES as string[]).includes(value) ? (value as HashType) : 'type'
}
function scriptFromRaw(s: RawRpcScript): Script {
  return { codeHash: s.code_hash, hashType: hashType(s.hash_type), args: s.args }
}

/**
 * Normalize a raw RPC transaction (as pasted for simulation) into the model,
 * given best-effort resolved input cells. There is no committed hash/block, so
 * the tx is marked pending with an empty hash; the flow renders it all the same.
 */
export function normalizeRawTransaction(
  raw: RawRpcTransaction,
  inputCells: (Cell | undefined)[],
  network: Network,
): Transaction {
  const outputs: Cell[] = raw.outputs.map((o, i) => {
    const lock = scriptFromRaw(o.lock)
    const type = o.type ? scriptFromRaw(o.type) : undefined
    const data = raw.outputs_data[i] ?? '0x'
    const cell: Cell = {
      capacity: BigInt(o.capacity),
      occupiedCapacity: occupiedCapacity(lock, type, data),
      lock,
      data,
    }
    if (type) cell.type = type
    return cell
  })

  const inputs: Input[] = raw.inputs.map((inp, i) => {
    const outPoint = { txHash: inp.previous_output.tx_hash, index: Number(BigInt(inp.previous_output.index)) }
    const base: Input = { outPoint, since: decodeSince(BigInt(inp.since || '0x0')) }
    const cell = inputCells[i]
    if (cell) base.cell = cell
    return base
  })

  const cellDeps: CellDep[] = raw.cell_deps.map((d) => ({
    outPoint: { txHash: d.out_point.tx_hash, index: Number(BigInt(d.out_point.index)) },
    depType: d.dep_type === 'dep_group' ? 'depGroup' : 'code',
  }))

  const outputsTotal = outputs.reduce((a, c) => a + c.capacity, 0n)
  const allResolved = inputs.length > 0 && inputs.every((i) => i.cell)
  const inputsTotal = allResolved ? inputs.reduce((a, i) => a + (i.cell?.capacity ?? 0n), 0n) : undefined
  const fee = inputsTotal !== undefined ? inputsTotal - outputsTotal : undefined

  const result: Transaction = {
    hash: '',
    network,
    status: 'pending',
    size: 0,
    inputs,
    outputs,
    cellDeps,
    headerDeps: raw.header_deps,
    witnesses: raw.witnesses,
  }
  if (fee !== undefined) result.fee = fee
  return result
}
