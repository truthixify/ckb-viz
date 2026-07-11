import { clsx } from '@/app/clsx'
import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { formatBytes, formatCkb, formatInt, formatTimestamp } from '@/domain/units'
import type { DecodeResult } from '@/decode/decoder'
import { StatusDot } from '../common/StatusDot'

/**
 * The summary banner (SPEC §9.1b): the plain-language decode as the headline,
 * with the key readings beside it. The headline is always marked inferred where
 * it is inferred, never presented as ground truth the chain asserted.
 */
export function SummaryBanner({
  transaction,
  capacity,
  summary,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  summary: DecodeResult
}) {
  return (
    <section className="flex flex-col gap-6 border border-hairline bg-panel px-7 py-6">
      <div className="flex flex-col gap-3">
        <span className="meta-label">Transaction summary</span>
        <h1
          className={clsx(
            'max-w-3xl text-[32px] font-medium leading-tight tracking-tight text-bone',
            summary.inferred && 'inferred',
          )}
        >
          {summary.headline}
        </h1>
      </div>

      <dl className="flex flex-wrap gap-x-12 gap-y-5">
        <Reading label="Fee">
          <span className="text-ember">
            {capacity.fee === undefined ? '—' : `${formatCkb(capacity.fee)} CKB`}
          </span>
        </Reading>
        <Reading label="Size">{formatBytes(transaction.size)}</Reading>
        <Reading label="Cycles">
          {transaction.cyclesConsumed === undefined ? '—' : formatInt(transaction.cyclesConsumed)}
        </Reading>
        <Reading label="Inputs">{formatInt(transaction.inputs.length)}</Reading>
        <Reading label="Outputs">{formatInt(transaction.outputs.length)}</Reading>
        <Reading label="Block">
          {transaction.blockNumber === undefined ? '—' : formatInt(transaction.blockNumber)}
        </Reading>
        <Reading label="Time">
          {transaction.timestamp === undefined ? '—' : formatTimestamp(transaction.timestamp)}
        </Reading>
        <Reading label="Status">
          <StatusDot status={transaction.status} />
        </Reading>
      </dl>
    </section>
  )
}

function Reading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="meta-label">{label}</dt>
      <dd className="mono text-[13px] text-bone">{children}</dd>
    </div>
  )
}
