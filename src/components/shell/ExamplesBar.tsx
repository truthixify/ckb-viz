import { clsx } from '@/app/clsx'
import { examplesForNetwork } from '@/app/examples'
import type { Network } from '@/domain/types'

/**
 * Curated examples: each chip finds a recent real transaction of that kind via
 * the indexer, so a visitor can see the decoder's range (a DAO deposit, a named
 * token transfer) without waiting to stumble on one.
 */
export function ExamplesBar({
  network,
  finding,
  onPick,
}: {
  network: Network
  finding: string | null
  onPick: (kindId: string, label: string) => void
}) {
  const kinds = examplesForNetwork(network)
  if (kinds.length === 0) return null

  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-hairline px-5 py-2.5">
      <span className="meta-label-sm shrink-0">Find a</span>
      {kinds.map((kind) => {
        const isFinding = finding === kind.id
        return (
          <button
            key={kind.id}
            type="button"
            disabled={finding !== null}
            onClick={() => onPick(kind.id, kind.label)}
            className={clsx(
              'mono shrink-0 border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
              isFinding
                ? 'border-ember text-ember'
                : 'border-border text-bone-dim hover:border-bone-dim hover:text-bone disabled:opacity-40',
            )}
          >
            {isFinding ? 'Finding…' : kind.label}
          </button>
        )
      })}
    </div>
  )
}
