import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { truncateHash } from '@/domain/units'
import { CountingCkb } from '../common/CountingCkb'
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
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  registerRef: (el: HTMLElement | null) => void
  onCopy: (text: string) => void
}) {
  return (
    <div
      ref={registerRef}
      className="flex w-full flex-col gap-5 border border-[color:var(--color-ember)] bg-panel px-6 py-5"
      style={{ backgroundImage: 'linear-gradient(var(--color-ember-well), var(--color-ember-well))', backgroundSize: '100% 3px', backgroundRepeat: 'no-repeat' }}
    >
      <div className="flex flex-col gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-ember)]">
          Transaction
        </span>
        <button
          type="button"
          className="mono copyable self-start text-[15px] text-bone"
          onClick={() => onCopy(transaction.hash)}
          title="Copy transaction hash"
        >
          {truncateHash(transaction.hash, 8, 8)}
        </button>
      </div>

      <dl className="flex flex-col gap-3">
        <Row label="Fee">
          <span className="mono text-[13px] text-[color:var(--color-ember)]">
            {capacity.fee === undefined ? '—' : <><CountingCkb value={capacity.fee} duration={850} delay={300} /> CKB</>}
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
