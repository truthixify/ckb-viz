import { useState } from 'react'
import type { Transaction } from '@/domain/types'
import { formatBytes, truncateHash } from '@/domain/units'
import { decodeWitness } from '@/decode/witness'

/**
 * Transaction-level detail that is noise for most reads and detail for some
 * (SPEC §9): the witnesses (parsed as WitnessArgs where they are) and the
 * header deps. Collapsed by default.
 */
export function TransactionExtras({
  transaction,
  onCopy,
}: {
  transaction: Transaction
  onCopy: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { witnesses, headerDeps } = transaction
  if (witnesses.length === 0 && headerDeps.length === 0) return null

  return (
    <div className="border-t border-hairline pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-bone-dim"
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        Witnesses · {witnesses.length}
        {headerDeps.length > 0 && ` · header deps · ${headerDeps.length}`}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          {witnesses.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="meta-label-sm">Witnesses</span>
              <div className="flex flex-col gap-1.5">
                {witnesses.map((w, i) => {
                  const view = decodeWitness(w)
                  const parts = view.isWitnessArgs
                    ? [
                        view.lock !== undefined && `lock ${view.lock}B`,
                        view.inputType !== undefined && `input_type ${view.inputType}B`,
                        view.outputType !== undefined && `output_type ${view.outputType}B`,
                      ].filter(Boolean)
                    : []
                  return (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="mono text-[10px] text-muted">#{i}</span>
                      <button
                        type="button"
                        onClick={() => onCopy(w)}
                        title="Copy witness"
                        className="mono copyable text-left text-[11px] text-bone-dim"
                      >
                        {view.isWitnessArgs ? (
                          <>
                            <span className="text-bone">WitnessArgs</span>
                            {parts.length > 0 && <span className="text-muted"> · {parts.join(' · ')}</span>}
                          </>
                        ) : (
                          <span className="text-muted">{formatBytes(view.totalBytes)} raw</span>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {headerDeps.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="meta-label-sm">Header deps</span>
              <div className="flex flex-col gap-1.5">
                {headerDeps.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onCopy(h)}
                    title="Copy header hash"
                    className="mono copyable text-left text-[11px] text-muted"
                  >
                    {truncateHash(h, 10, 8)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
