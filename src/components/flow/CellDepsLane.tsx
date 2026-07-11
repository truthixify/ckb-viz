import { useState } from 'react'
import type { CellDep } from '@/domain/types'
import { formatOutPoint } from '@/domain/units'

/**
 * The cell-deps lane (SPEC §9.2): deps feed the spine but are read-not-consumed,
 * so they sit in a distinct amber-marked lane below the flow, centered and
 * expanded by default.
 */
export function CellDepsLane({
  cellDeps,
  onCopy,
}: {
  cellDeps: CellDep[]
  onCopy: (text: string) => void
}) {
  const [open, setOpen] = useState(true)
  if (cellDeps.length === 0) return null

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors"
        style={{ color: 'var(--color-dep)' }}
      >
        <span
          aria-hidden
          className="inline-block w-4"
          style={{ borderTop: '1px dashed var(--color-dep)' }}
        />
        <span>
          Cell deps · {cellDeps.length} · {open ? 'Hide' : 'Show'}
        </span>
        <span
          aria-hidden
          className="inline-block w-4"
          style={{ borderTop: '1px dashed var(--color-dep)' }}
        />
      </button>

      {open && (
        <div className="flex max-w-[760px] flex-wrap justify-center gap-3">
          {cellDeps.map((dep, i) => (
            <div
              key={`${dep.outPoint.txHash}:${dep.outPoint.index}`}
              className="dep-chip p-[3px] transition-colors"
            >
              <div className="flex min-w-[150px] flex-col gap-1.5 bg-panel px-3.5 py-2.5">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-dep)' }}
                  />
                  <span className="text-[13px] font-medium text-bone">
                    {dep.resolved
                      ? `${dep.resolved.shortName} ${dep.depType === 'depGroup' ? 'dep group' : 'code'}`
                      : `Dep ${i + 1}`}
                  </span>
                </span>
                <span className="meta-label-sm">
                  {dep.depType === 'depGroup' ? 'Dep group' : 'Code'} · Read-only
                </span>
                <button
                  type="button"
                  className="mono copyable text-left text-[10px] text-muted"
                  onClick={() => onCopy(`${dep.outPoint.txHash}:${dep.outPoint.index}`)}
                  title="Copy out-point"
                >
                  {formatOutPoint(dep.outPoint)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
