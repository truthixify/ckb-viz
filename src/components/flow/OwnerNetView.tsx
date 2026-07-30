import { useMemo, useState } from 'react'
import type { CapacityBreakdown, Cell, Transaction } from '@/domain/types'
import { computeNetChange, type OwnerNetChange } from '@/domain/netChange'
import { formatCkb, formatFee, truncateHash } from '@/domain/units'
import { formatUdtAmount } from '@/decode/udt'
import { clsx } from '@/app/clsx'
import { cellId, type CellSide } from './types'

/**
 * The owner-net view (SPEC §9.9): who gained and who lost, rather than a cell
 * by cell flow. Cells are grouped by their lock (one party = one lock); each
 * party shows its net CKB and net tokens, and expands to the cells it spent and
 * received. A 263-output payout reads as one payer and N recipients.
 *
 * The net is exact only when every input is resolved. On a large, sampled
 * transaction the payer side is unknown, so this shows what each address
 * received and says plainly that the net and payers are not yet known.
 */
export function OwnerNetView({
  transaction,
  capacity,
  selectedId,
  onSelectCell,
  onCopy,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  selectedId: string | null
  onSelectCell: (cell: Cell, id: string) => void
  onCopy: (text: string) => void
}) {
  const net = useMemo(() => computeNetChange(transaction), [transaction])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2.5">
          <span className="meta-label">Owner net</span>
          <span className="mono text-[9px] uppercase tracking-[0.14em] text-muted">· inferred</span>
        </span>
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {net.complete ? 'net = out − in' : 'received only'}
        </span>
      </div>

      {!net.complete && (
        <p className="border border-hairline bg-panel px-4 py-3 text-[12px] leading-relaxed text-muted">
          Not all inputs are resolved, so the payers and the true net are not known yet. Showing what
          each address received. Resolve all inputs from the summary above to see the full net.
        </p>
      )}

      <div className="flex flex-col border border-hairline bg-panel">
        {net.owners.map((owner) => (
          <OwnerRow
            key={owner.key}
            owner={owner}
            complete={net.complete}
            selectedId={selectedId}
            onSelectCell={onSelectCell}
            onCopy={onCopy}
          />
        ))}
        {net.complete && capacity.fee !== undefined && (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted">Fee (to miners)</span>
            <span className="mono text-[13px] text-ember">−{formatFee(capacity.fee)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function OwnerRow({
  owner,
  complete,
  selectedId,
  onSelectCell,
  onCopy,
}: {
  owner: OwnerNetChange
  complete: boolean
  selectedId: string | null
  onSelectCell: (cell: Cell, id: string) => void
  onCopy: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { primary, secondary } = ownerLabel(owner)
  const roleTag = complete
    ? owner.isChange
      ? 'change'
      : owner.netCkb > 0n
        ? 'received'
        : owner.netCkb < 0n
          ? 'spent'
          : 'no change'
    : 'received'

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-raised"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span aria-hidden className="mono text-[10px] text-muted">{open ? '▾' : '▸'}</span>
            <span className="mono truncate text-[12px] text-bone">{primary}</span>
            <span className="mono text-[9px] uppercase tracking-[0.12em] text-muted">{roleTag}</span>
          </span>
          <span className="mono pl-[18px] text-[10px] text-muted">
            {secondary}
            {secondary && ' · '}
            {owner.inputCells} in · {owner.outputCells} out
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <SignedCkb shannons={complete ? owner.netCkb : owner.outCapacity} forcePositive={!complete} />
          {owner.tokens.map((t) => (
            <span key={t.key} className="mono text-[11px] text-bone-dim">
              <SignText amount={t.amount} />
              {formatUdtAmount(t.amount < 0n ? -t.amount : t.amount, t.decimals ?? 0)}{' '}
              <span className="text-muted">{t.symbol ?? 'token'}</span>
            </span>
          ))}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 px-4 pb-3.5 pl-[34px]">
          <button
            type="button"
            onClick={() => owner.address && onCopy(owner.address)}
            className="mono copyable self-start break-all text-left text-[10px] text-muted"
            title={owner.address ? 'Copy address' : undefined}
            disabled={!owner.address}
          >
            {owner.address ?? owner.lock.codeHash}
          </button>
          {owner.members.map((m) => {
            const id = cellId(m.side as CellSide, m.index)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCell(m.cell, id)}
                className={clsx(
                  'flex items-center justify-between gap-3 border px-3 py-2 text-left transition-colors',
                  selectedId === id ? 'border-ember bg-raised' : 'border-hairline hover:border-border',
                )}
              >
                <span className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.1em]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: m.side === 'input' ? 'var(--color-flow-in)' : 'var(--color-flow-out)' }}
                  />
                  <span className="text-muted">{m.side === 'input' ? 'spent' : `output #${m.index}`}</span>
                </span>
                <span className="mono text-[11px] text-bone-dim">{formatCkb(m.cell.capacity)} CKB</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SignedCkb({ shannons, forcePositive }: { shannons: bigint; forcePositive: boolean }) {
  const positive = forcePositive || shannons > 0n
  const color = shannons === 0n && !forcePositive ? 'var(--color-muted)' : positive ? 'var(--color-flow-out)' : 'var(--color-alarm)'
  const sign = shannons === 0n && !forcePositive ? '' : positive ? '+' : '−'
  const abs = shannons < 0n ? -shannons : shannons
  return (
    <span className="mono text-[13px] tabular-nums" style={{ color }}>
      {sign}
      {formatCkb(abs)} <span className="text-[10px] text-muted">CKB</span>
    </span>
  )
}

function SignText({ amount }: { amount: bigint }) {
  return <span style={{ color: amount >= 0n ? 'var(--color-flow-out)' : 'var(--color-alarm)' }}>{amount >= 0n ? '+' : '−'}</span>
}

/** A readable label for an owner: address (truncated), else the recognized lock
 *  name, else a shortened code hash — never a guessed identity (SPEC §7). */
function ownerLabel(owner: OwnerNetChange): { primary: string; secondary: string } {
  if (owner.address) {
    return { primary: truncateHash(owner.address, 10, 6), secondary: owner.lock.known?.shortName ?? '' }
  }
  if (owner.lock.known) {
    return { primary: owner.lock.known.shortName, secondary: truncateHash(owner.lock.codeHash, 6, 4) }
  }
  return { primary: 'Unrecognized lock', secondary: truncateHash(owner.lock.codeHash, 6, 6) }
}
