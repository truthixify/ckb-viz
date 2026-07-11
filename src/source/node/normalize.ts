import {
  Address,
  type CellOutput as CccCellOutput,
  type ClientBlockHeader,
  type ClientTransactionResponse,
  type Script as CccScript,
  type Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { occupiedCapacity } from '@/domain/capacity'
import type { Cell, CellDep, Input, Network, Script, Transaction, TxStatus } from '@/domain/types'
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
