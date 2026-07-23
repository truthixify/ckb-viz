import { clsx } from '@/app/clsx'
import { examplesForNetwork } from '@/app/examples'
import type { Network } from '@/domain/types'

/**
 * The secondary nav: curated example chips (each finds a recent real tx of that
 * kind via the indexer, so a visitor sees the decoder's range) and the entry
 * point to the transaction simulator.
 */
export function ExamplesBar({
  network,
  finding,
  onPick,
  simulate,
  onSimulate,
  learn,
  onLearn,
}: {
  network: Network
  finding: string | null
  onPick: (kindId: string, label: string) => void
  simulate: boolean
  onSimulate: () => void
  learn: boolean
  onLearn: () => void
}) {
  const kinds = examplesForNetwork(network)

  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-hairline px-5 py-2.5">
      {kinds.length > 0 && (
        <>
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
          <span aria-hidden className="shrink-0 text-hairline">
            ·
          </span>
        </>
      )}
      <button
        type="button"
        onClick={onLearn}
        className={clsx(
          'mono shrink-0 text-[10px] uppercase tracking-[0.12em] transition-colors',
          learn ? 'text-ember' : 'text-muted hover:text-bone',
        )}
      >
        Learn ◆
      </button>
      <span aria-hidden className="shrink-0 text-hairline">
        ·
      </span>
      <button
        type="button"
        onClick={onSimulate}
        className={clsx(
          'mono shrink-0 text-[10px] uppercase tracking-[0.12em] transition-colors',
          simulate ? 'text-ember' : 'text-muted hover:text-bone',
        )}
      >
        Simulate a transaction →
      </button>
    </div>
  )
}
