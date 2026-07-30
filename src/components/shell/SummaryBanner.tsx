import { useNow } from '@/app/motion'
import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { formatBytes, formatCkb, formatFee, formatInt, formatRelativeTime, formatTimestamp } from '@/domain/units'
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
  resolving,
  onResolveAll,
  onCancelResolve,
  onCopyLink,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  summary: DecodeResult
  /** Progress of an in-flight resolve-all, or null when none is running. */
  resolving?: { done: number; total: number } | null
  onResolveAll?: () => void
  onCancelResolve?: () => void
  onCopyLink: () => void
}) {
  const now = useNow(30_000)
  const inputsUnresolved = capacity.inputsTotal === undefined && transaction.inputs.length > 0
  return (
    <section className="vz-enter flex flex-col gap-6 border border-hairline bg-panel px-5 py-5 min-[560px]:px-7 min-[560px]:py-6">
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
        {inputsUnresolved && !resolving && (
          <div className="flex max-w-3xl flex-col items-start gap-3">
            <p className="text-[12px] leading-relaxed text-muted">
              Only some of this transaction's {formatInt(transaction.inputs.length)} inputs could be resolved, so the input total and the fee are not shown.
            </p>
            {onResolveAll && (
              <button
                type="button"
                onClick={onResolveAll}
                className="mono border border-border px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-ember hover:text-ember"
                title={`Fetch all ${formatInt(transaction.inputs.length)} inputs (up to that many node requests)`}
              >
                Resolve all {formatInt(transaction.inputs.length)} inputs and compute the fee
              </button>
            )}
          </div>
        )}
        {resolving && (
          <div className="flex max-w-3xl flex-col gap-2">
            <span className="text-[12px] leading-relaxed text-muted">Resolving inputs to compute the fee…</span>
            <div className="flex items-center gap-4">
              <div className="h-1.5 flex-1 bg-raised" role="progressbar" aria-valuenow={resolving.done} aria-valuemin={0} aria-valuemax={resolving.total}>
                <div
                  className="h-full bg-ember transition-[width] duration-200"
                  style={{ width: resolving.total > 0 ? `${Math.min(100, (resolving.done / resolving.total) * 100)}%` : '0%' }}
                />
              </div>
              <span className="mono whitespace-nowrap text-[11px] text-muted">
                {formatInt(resolving.done)} / {formatInt(resolving.total)}
              </span>
              {onCancelResolve && (
                <button
                  type="button"
                  onClick={onCancelResolve}
                  className="mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ember"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-5 min-[560px]:gap-x-12">
        <Reading label="Fee">
          <span className="text-ember">{formatFee(capacity.fee)}</span>
        </Reading>
        {capacity.daoCompensation !== undefined && (
          <Reading label="DAO interest">
            <span style={{ color: 'var(--color-flow-out)' }}>
              +{formatCkb(capacity.daoCompensation)} CKB
            </span>
          </Reading>
        )}
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
