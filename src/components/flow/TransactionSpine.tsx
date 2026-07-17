import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { formatFee, truncateHash } from '@/domain/units'
import { StatusDot } from '../common/StatusDot'

/**
 * The transaction spine — the ember-bordered centre of the flow. Connectors fan
 * into its left edge from the inputs and out its right edge to the outputs, so
 * the fee reads as the difference between the two sides.
 */
export function TransactionSpine({
  transaction,
  capacity,
  registerRef,
  onCopy,
  simulated = false,
  failed = false,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  registerRef: (el: HTMLElement | null) => void
  onCopy: (text: string) => void
  simulated?: boolean
  failed?: boolean
}) {
  const accent = failed ? 'var(--color-alarm)' : 'var(--color-ember)'
  return (
    <div
      ref={registerRef}
      className="flex w-full flex-col gap-5 border bg-panel px-6 py-5"
      style={{
        borderColor: accent,
        backgroundImage: failed
          ? 'none'
          : 'linear-gradient(var(--color-ember-well), var(--color-ember-well))',
        backgroundSize: '100% 3px',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>
          {failed ? 'Transaction · rejected' : 'Transaction'}
        </span>
        {simulated || !transaction.hash ? (
          <span className="mono self-start text-[15px] text-bone-dim">
            {failed ? 'Rejected · not accepted' : 'Simulated · not yet on-chain'}
          </span>
        ) : (
          <button
            type="button"
            className="mono copyable self-start text-[15px] text-bone"
            onClick={() => onCopy(transaction.hash)}
            title="Copy transaction hash"
          >
            {truncateHash(transaction.hash, 8, 8)}
          </button>
        )}
      </div>

      <dl className="flex flex-col gap-3">
        <Row label="Fee">
          <span className="mono text-[13px]" style={{ color: accent }}>
            {formatFee(capacity.fee)}
          </span>
        </Row>
        <Row label="In / Out">
          <span className="mono text-[13px] text-bone">
            {transaction.inputs.length} <span className="text-muted">→</span> {transaction.outputs.length}
          </span>
        </Row>
        <Row label="Status">
          <StatusDot status={transaction.status} />
        </Row>
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="meta-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
