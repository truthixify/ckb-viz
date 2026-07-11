import { useState } from 'react'
import type { CellDep } from '@/domain/types'
import { formatOutPoint } from '@/domain/units'

/**
 * The cell-deps lane (SPEC §9.2): deps feed the spine but are read-not-consumed,
 * so they sit in a distinct amber-marked lane, collapsed by default because the
 * same few system scripts repeat.
 */
export function CellDepsLane({
  cellDeps,
  onCopy,
  registerRef,
}: {
  cellDeps: CellDep[]
  onCopy: (text: string) => void
  registerRef?: (el: HTMLElement | null) => void
}) {
  const [open, setOpen] = useState(false)
  if (cellDeps.length === 0) return null

  return (
    <div ref={registerRef} className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-bone-dim"
      >
        <Dashes />
        <span>Cell deps · {cellDeps.length} · {open ? 'Hide' : 'Show'}</span>
        <Dashes />
      </button>

      {open && (
        <div className="flex flex-wrap justify-center gap-3">
          {cellDeps.map((dep, i) => (
            <div
              key={`${dep.outPoint.txHash}:${dep.outPoint.index}`}
              className="flex flex-col gap-1.5 border border-hairline bg-panel px-4 py-3"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-dep)' }}
                />
                <span className="text-[13px] text-bone">
                  {dep.resolved ? `${dep.resolved.shortName} ${dep.depType === 'depGroup' ? 'dep group' : 'code'}` : `Dep ${i + 1}`}
                </span>
              </span>
              <span className="meta-label-sm">
                {dep.depType === 'depGroup' ? 'Dep group' : 'Code'} · Read-only
              </span>
              <button
                type="button"
                className="mono copyable text-[11px] text-muted"
                onClick={() => onCopy(`${dep.outPoint.txHash}:${dep.outPoint.index}`)}
                title="Copy out-point"
              >
                {formatOutPoint(dep.outPoint)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Dashes() {
  return <span aria-hidden className="text-hairline">————</span>
}
