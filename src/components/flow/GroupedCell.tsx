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
  unresolved = false,
  id,
  active,
  onActivate,
  onExpand,
  registerRef,
}: {
  side: CellSide
  count: number
  sumCapacity: bigint
  /** True when this side was only sampled (a large transaction), so the combined
   *  capacity is unknown and the group must not expand into thousands of cards. */
  unresolved?: boolean
  id: string
  active: boolean
  onActivate: (id: string | null) => void
  onExpand: () => void
  registerRef: (id: string, el: HTMLElement | null) => void
}) {
  const isOutput = side === 'output'
  const interactive = !unresolved
  return (
    <div
      ref={(el) => registerRef(id, el)}
      data-flow-cell
      aria-label={interactive ? `${count} more cells, expand` : `${count} more cells, capacity not resolved`}
      onMouseEnter={() => onActivate(id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(id)}
      onBlur={() => onActivate(null)}
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onExpand,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onExpand()
              }
            },
          }
        : {})}
      className={clsx(
        'flex flex-col gap-1.5 border border-dashed bg-panel px-5 py-3.5 transition-colors',
        isOutput ? 'items-end text-right' : 'items-start text-left',
        active ? 'border-border bg-raised' : 'border-border',
      )}
    >
      <span className="mono text-[13px] uppercase tracking-[0.1em] text-bone-dim">+{count} cells</span>
      <span className="mono text-[11px] text-muted">{unresolved ? 'capacity not resolved' : `Σ ${formatCkb(sumCapacity)} CKB`}</span>
    </div>
  )
}
