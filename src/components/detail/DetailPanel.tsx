import { useEffect, useRef } from 'react'
import type { Cell } from '@/domain/types'
import { ckbParts, formatCkb, formatOutPoint } from '@/domain/units'
import type { CellSide } from '../flow/types'
import { ScriptDetail } from './ScriptDetail'

/**
 * The detail panel (SPEC §9.4): the full cell — exact and occupied capacity,
 * the lock and type scripts, the raw data with a decoded view — every hash
 * copyable. Opened by selecting a cell; Escape closes it and restores focus.
 * Also the entry point to lineage: trace an input back, an output forward.
 */
export function DetailPanel({
  cell,
  side,
  index,
  onClose,
  onCopy,
  canTraceForward,
  onTraceBackward,
  onTraceForward,
}: {
  cell: Cell
  side: CellSide
  index?: number | undefined
  onClose: () => void
  onCopy: (text: string) => void
  canTraceForward: boolean
  onTraceBackward: () => void
  onTraceForward: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Close on a click outside the panel; a click on a flow cell is left to the
    // cell (so it switches the panel to that cell rather than closing).
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (asideRef.current?.contains(target)) return
      if (target?.closest('[data-flow-cell]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      prev?.focus?.()
    }
  }, [onClose])

  const { int, frac } = ckbParts(cell.capacity)
  const decoded = cell.decoded

  return (
    <aside
      ref={asideRef}
      role="dialog"
      aria-label="Cell detail"
      className="fixed inset-y-0 right-0 z-30 flex w-[420px] max-w-full flex-col overflow-y-auto border-l border-border bg-panel-2 max-[560px]:w-full"
    >
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <span className="meta-label">
          {side === 'output' ? `Output #${index}` : 'Input'} · Cell detail
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="mono text-[16px] leading-none text-muted transition-colors hover:text-bone"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex flex-col gap-2">
          <span className="meta-label">Capacity</span>
          <div className="flex items-baseline gap-1.5">
            <span className="mono text-[30px] font-medium leading-none text-bone">
              {int}
              {frac && <span className="text-bone-dim">.{frac}</span>}
            </span>
            <span className="mono text-[11px] uppercase tracking-[0.1em] text-muted">CKB</span>
          </div>
          <span className="mono text-[11px] text-muted">
            {formatCkb(cell.occupiedCapacity)} CKB occupied
          </span>
        </div>

        {cell.outPoint && (
          <button
            type="button"
            onClick={() => onCopy(`${cell.outPoint!.txHash}:${cell.outPoint!.index}`)}
            className="mono copyable self-start text-[11px] text-muted"
            title="Copy out-point"
          >
            {formatOutPoint(cell.outPoint)}
          </button>
        )}

        <ScriptDetail script={cell.lock} category="lock" onCopy={onCopy} />
        {cell.type && <ScriptDetail script={cell.type} category="type" onCopy={onCopy} />}

        <div className="flex flex-col gap-2">
          <span className="meta-label">Data</span>
          {decoded && decoded.kind !== 'empty' && (
            <span className={`mono break-all text-[12px] text-bone-dim ${decoded.inferred ? 'inferred' : ''}`}>
              {decoded.label}
            </span>
          )}
          {decoded?.imageDataUri && (
            <img
              src={decoded.imageDataUri}
              alt={decoded.contentType ?? 'Spore content'}
              className="well max-h-72 w-full object-contain p-2"
            />
          )}
          {cell.data === '0x' ? (
            <span className="mono text-[11px] text-muted">No data</span>
          ) : (
            <button
              type="button"
              onClick={() => onCopy(cell.data)}
              title="Copy raw data"
              className="well copyable mono max-h-40 overflow-y-auto break-all px-3 py-2 text-left text-[11px] text-bone-dim"
            >
              {cell.data}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <span className="meta-label">Lineage</span>
          {side === 'input' ? (
            <button
              type="button"
              onClick={onTraceBackward}
              className="mono self-start border border-border px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-bone-dim transition-colors hover:border-ember hover:text-ember"
            >
              ← Trace origin
            </button>
          ) : canTraceForward ? (
            <button
              type="button"
              onClick={onTraceForward}
              className="mono self-start border border-border px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-bone-dim transition-colors hover:border-ember hover:text-ember"
            >
              Trace forward →
            </button>
          ) : (
            <span className="text-[11px] text-muted">
              Forward lineage needs an indexer or explorer source.
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
