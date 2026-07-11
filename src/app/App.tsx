import { useMemo, useState } from 'react'
import { BrandMark } from '@/components/brand/BrandMark'
import { FlowCanvas } from '@/components/flow/FlowCanvas'
import { enrichTransaction } from '@/decode/enrich'
import type { Cell } from '@/domain/types'
import { ScriptRegistry } from '@/registry/registry'
import { EXAMPLES } from '@/source/bundled/examples'

/**
 * App shell. This batch renders the flow — the signature centrepiece — for the
 * default example. The input bar, network selector, summary banner, detail
 * panel, and lineage are wired in the next batch.
 */
export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const enriched = useMemo(() => {
    const registry = new ScriptRegistry('mainnet')
    return enrichTransaction(EXAMPLES[0]!.transaction, registry)
  }, [])

  const onCopy = (text: string) => {
    void navigator.clipboard?.writeText(text)
  }
  const onSelectCell = (_cell: Cell, id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }

  return (
    <div className="flex min-h-dvh flex-col bg-base text-bone">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
        <BrandMark />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-[440px] max-w-[46vw] items-center border border-border bg-inset px-3">
            <span className="mono truncate text-[13px] text-muted">Paste a transaction hash…</span>
          </div>
          <button
            type="button"
            className="mono h-9 border border-border bg-panel px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-bone-dim"
            disabled
          >
            Read
          </button>
          <div className="flex items-center gap-1 border border-border">
            <span className="mono bg-panel-2 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-ember">
              Mainnet
            </span>
            <span className="mono px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-muted">
              Testnet
            </span>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-hairline px-5 py-2.5">
        <span className="meta-label-sm">Examples</span>
        {EXAMPLES.map((ex) => (
          <span
            key={ex.id}
            className="mono border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-bone-dim"
          >
            {ex.label}
          </span>
        ))}
      </div>

      <main className="flex-1 overflow-x-auto px-6 py-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 flex flex-col gap-2">
            <span className="meta-label">Transaction summary</span>
            <h1 className={`text-[34px] font-medium leading-tight tracking-tight text-bone ${enriched.summary.inferred ? 'inferred' : ''}`}>
              {enriched.summary.headline}
            </h1>
          </div>

          <FlowCanvas
            transaction={enriched.transaction}
            capacity={enriched.capacity}
            selectedId={selectedId}
            onSelectCell={onSelectCell}
            onCopy={onCopy}
          />
        </div>
      </main>
    </div>
  )
}
