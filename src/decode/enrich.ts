import type { Cell, CapacityBreakdown, CellDep, Input, Transaction } from '@/domain/types'
import { ScriptRegistry } from '@/registry/registry'
import { decodeCellData } from './data'
import { decodeTransaction, type DecodeResult } from './decoder'

/**
 * The enrichment pipeline (SPEC §11.5): source adapter → normalizer → registry
 * → decoder → view. Given a raw normalized transaction, annotate every script
 * against the registry, decode every cell's data, resolve cell deps, compute
 * the capacity breakdown, and produce the one-sentence summary. Pure and
 * immutable — returns a new transaction, never mutating the input.
 */
export interface EnrichedTransaction {
  transaction: Transaction
  summary: DecodeResult
  capacity: CapacityBreakdown
}

export function enrichTransaction(tx: Transaction, registry: ScriptRegistry): EnrichedTransaction {
  const enrichCell = (cell: Cell): Cell => {
    const enriched: Cell = {
      ...cell,
      lock: registry.annotate(cell.lock),
      decoded: decodeCellData(cell, registry.network, registry),
    }
    if (cell.type) enriched.type = registry.annotate(cell.type)
    return enriched
  }

  const outputs = tx.outputs.map(enrichCell)
  const inputs: Input[] = tx.inputs.map((input) =>
    input.cell ? { ...input, cell: enrichCell(input.cell) } : input,
  )
  const cellDeps: CellDep[] = tx.cellDeps.map((dep) => {
    const resolved = registry.resolveDep(dep)
    return resolved ? { ...dep, resolved } : dep
  })

  const transaction: Transaction = { ...tx, inputs, outputs, cellDeps }

  const outputsTotal = outputs.reduce((a, c) => a + c.capacity, 0n)
  const allInputsResolved = inputs.length > 0 && inputs.every((i) => i.cell)
  const inputsTotal = allInputsResolved
    ? inputs.reduce((a, i) => a + (i.cell?.capacity ?? 0n), 0n)
    : undefined
  const fee = tx.fee ?? (inputsTotal !== undefined ? inputsTotal - outputsTotal : undefined)

  const capacity: CapacityBreakdown = { inputsTotal, outputsTotal, fee }
  if (tx.daoCompensation !== undefined) capacity.daoCompensation = tx.daoCompensation
  const summary = decodeTransaction(transaction, registry.network, registry)

  return { transaction, summary, capacity }
}

export function makeRegistry(network: ScriptRegistry['network']): ScriptRegistry {
  return new ScriptRegistry(network)
}
