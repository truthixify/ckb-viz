import { BrandMark } from '@/components/brand/BrandMark'

/**
 * App shell. This batch establishes the instrument frame — the top bar and the
 * page regions — against the real design tokens. The input bar, summary banner,
 * flow, detail panel, and lineage are wired in over the following batches.
 */
export function App() {
  return (
    <div className="flex min-h-dvh flex-col bg-base text-bone">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
        <BrandMark />

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-[440px] max-w-[46vw] items-center border border-border bg-inset px-3">
            <span className="mono truncate text-[13px] text-muted">
              Paste a transaction hash…
            </span>
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
        {['CKB transfer', 'Token (xUDT)', 'Nervos DAO', 'Batch payout', 'Unrecognized'].map(
          (label) => (
            <span
              key={label}
              className="mono border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-bone-dim"
            >
              {label}
            </span>
          ),
        )}
      </div>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="meta-label">Scaffold ready</span>
          <p className="max-w-md text-[13px] leading-relaxed text-bone-dim">
            The instrument frame and design tokens are live. The summary banner, the
            flow of cells, the decoder, and the detail panel land in the next batches.
          </p>
        </div>
      </main>
    </div>
  )
}
