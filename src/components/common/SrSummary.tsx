import type { CapacityBreakdown, Cell, Transaction } from '@/domain/types'
import { formatCkb } from '@/domain/units'
import type { DecodeResult } from '@/decode/decoder'

/**
 * A screen-reader-only text alternative for the visual flow (SPEC §13.2): the
 * plain-language decode, the key readings, and each cell announced with its
 * capacity, decoded lock and type, and whether it carries data — so the flow is
 * legible without seeing it.
 */
export function SrSummary({
  transaction,
  summary,
  capacity,
}: {
  transaction: Transaction
  summary: DecodeResult
  capacity: CapacityBreakdown
}) {
  const describe = (cell: Cell) => {
    const lock = cell.lock.known?.name ?? 'unrecognized lock'
    const type = cell.type ? (cell.type.known?.name ?? 'unrecognized type') : 'no type script'
    const data = !cell.decoded || cell.decoded.kind === 'empty' ? 'no data' : cell.decoded.label
    return `${formatCkb(cell.capacity)} CKB, ${lock}, ${type}, ${data}.`
  }

  return (
    <div className="sr-only">
      <p>
        {summary.headline}
        {summary.inferred ? ' (inferred).' : ''} Fee{' '}
        {capacity.fee === undefined ? 'unknown' : `${formatCkb(capacity.fee)} CKB`}. Status{' '}
        {transaction.status}. {transaction.inputs.length} input
        {transaction.inputs.length === 1 ? '' : 's'}, {transaction.outputs.length} output
        {transaction.outputs.length === 1 ? '' : 's'}.
      </p>
      <ol aria-label="Input cells">
        {transaction.inputs.map((input, i) => (
          <li key={i}>Input {i + 1}: {input.cell ? describe(input.cell) : 'unresolved.'}</li>
        ))}
      </ol>
      <ol aria-label="Output cells">
        {transaction.outputs.map((cell, i) => (
          <li key={i}>Output {i + 1}: {describe(cell)}</li>
        ))}
      </ol>
    </div>
  )
}
