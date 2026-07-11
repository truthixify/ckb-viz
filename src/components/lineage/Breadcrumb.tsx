import { clsx } from '@/app/clsx'
import { truncateHash } from '@/domain/units'

/**
 * The lineage breadcrumb (SPEC §9.5): the chain of transactions the user
 * stepped through, so they can see the path and step back to any prior one.
 */
export function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string[]
  onNavigate: (index: number) => void
}) {
  if (path.length <= 1) return null
  return (
    <nav aria-label="Lineage" className="flex flex-wrap items-center gap-2">
      <span className="meta-label-sm">Lineage</span>
      {path.map((hash, i) => {
        const isCurrent = i === path.length - 1
        return (
          <span key={`${hash}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted">→</span>}
            <button
              type="button"
              onClick={() => onNavigate(i)}
              aria-current={isCurrent ? 'page' : undefined}
              className={clsx(
                'mono text-[11px] transition-colors',
                isCurrent ? 'text-ember' : 'text-muted hover:text-bone-dim',
              )}
            >
              {truncateHash(hash, 6, 6)}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
