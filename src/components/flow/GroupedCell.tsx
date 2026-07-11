import { clsx } from '@/app/clsx'
import { formatCkb } from '@/domain/units'
import type { CellSide } from './types'

/**
 * A collapsed run of cells on a crowded side (SPEC §9.8). Reads the count and
 * combined capacity; expands on click/Enter. The layout never breaks and the
 * connector tracks this grouped anchor.
 */
export function GroupedCell({
  side,
  count,
  sumCapacity,
  id,
  active,
  onActivate,
  onExpand,
  registerRef,
}: {
  side: CellSide
  count: number
  sumCapacity: bigint
  id: string
  active: boolean
  onActivate: (id: string | null) => void
  onExpand: () => void
  registerRef: (id: string, el: HTMLElement | null) => void
}) {
  const isOutput = side === 'output'
  return (
    <div
      ref={(el) => registerRef(id, el)}
      role="button"
      tabIndex={0}
      aria-label={`${count} more cells, expand`}
      onMouseEnter={() => onActivate(id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(id)}
      onBlur={() => onActivate(null)}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onExpand()
        }
      }}
      className={clsx(
        'flex flex-col gap-1.5 border border-dashed bg-panel px-5 py-3.5 transition-colors',
        isOutput ? 'items-end text-right' : 'items-start text-left',
        active ? 'border-border bg-raised' : 'border-border',
      )}
    >
      <span className="mono text-[13px] uppercase tracking-[0.1em] text-bone-dim">
        +{count} cells
      </span>
      <span className="mono text-[11px] text-muted">Σ {formatCkb(sumCapacity)} CKB</span>
    </div>
  )
}
