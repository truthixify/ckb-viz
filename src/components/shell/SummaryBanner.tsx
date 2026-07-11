import { useNow } from '@/app/motion'
import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { formatBytes, formatFee, formatInt, formatRelativeTime, formatTimestamp } from '@/domain/units'
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
  onCopyLink,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  summary: DecodeResult
  onCopyLink: () => void
}) {
  const now = useNow(30_000)
  return (
    <section className="vz-enter flex flex-col gap-6 border border-hairline bg-panel px-7 py-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <span className="meta-label">Transaction summary</span>
            {summary.inferred && (
              <span className="mono text-[9px] uppercase tracking-[0.14em] text-muted">
                · inferred
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onCopyLink}
            className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ember"
            title="Copy a shareable link to this transaction"
          >
            <span aria-hidden>↗</span> Copy link
          </button>
        </div>
        <h1 className="max-w-3xl text-[32px] font-medium leading-tight tracking-tight text-bone">
          {summary.headline}
        </h1>
      </div>

      <dl className="flex flex-wrap gap-x-12 gap-y-5">
        <Reading label="Fee">
          <span className="text-ember">{formatFee(capacity.fee)}</span>
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
          {transaction.timestamp === undefined ? (
            '—'
          ) : (
            <span title={formatTimestamp(transaction.timestamp)}>
              {formatRelativeTime(transaction.timestamp, now)}
            </span>
          )}
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
