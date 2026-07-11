import type { TxStatus } from '@/domain/types'

const STATUS_COLOR: Record<TxStatus, string> = {
  committed: 'var(--color-flow-out)',
  proposed: 'var(--color-dep)',
  pending: 'var(--color-dep)',
  unknown: 'var(--color-muted)',
  rejected: 'var(--color-alarm)',
}

/** The one place a status hue may touch text-adjacent UI: a labeled dot. */
export function StatusDot({ status }: { status: TxStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      <span className="mono text-[11px] uppercase tracking-[0.12em] text-bone-dim">{status}</span>
    </span>
  )
}
