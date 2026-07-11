import { clsx } from '@/app/clsx'
import { EXAMPLES } from '@/source/bundled/examples'

/**
 * The examples strip (SPEC §9.1): one bundled transaction per decoded category,
 * so every feature is reachable without hunting for a hash.
 */
export function ExamplesBar({
  currentHash,
  onPick,
}: {
  currentHash: string | null
  onPick: (hash: string) => void
}) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-hairline px-5 py-2.5">
      <span className="meta-label-sm shrink-0">Examples</span>
      {EXAMPLES.map((ex) => {
        const active = ex.transaction.hash === currentHash
        return (
          <button
            key={ex.id}
            type="button"
            onClick={() => onPick(ex.transaction.hash)}
            className={clsx(
              'mono shrink-0 border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
              active
                ? 'border-ember text-ember'
                : 'border-border text-bone-dim hover:border-bone-dim hover:text-bone',
            )}
          >
            {ex.label}
          </button>
        )
      })}
    </div>
  )
}
