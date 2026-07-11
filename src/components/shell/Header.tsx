import { clsx } from '@/app/clsx'
import type { Network } from '@/domain/types'
import { BrandMark } from '../brand/BrandMark'

/**
 * The top bar (SPEC §9.1): the brand mark (Home), the hash input with a clear
 * affordance and READ, and the network selector. Switching network is a hard
 * context change that reloads the current hash against that network.
 */
export function Header({
  value,
  onChange,
  onSubmit,
  onClear,
  network,
  onNetwork,
  onHome,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClear: () => void
  network: Network
  onNetwork: (n: Network) => void
  onHome: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
      <BrandMark onHome={onHome} />

      <div className="flex items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-[440px] max-w-[44vw] items-center gap-2 border border-border bg-inset px-3 focus-within:border-ember">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="Paste a transaction hash…"
              aria-label="Transaction hash"
              className="mono min-w-0 flex-1 bg-transparent text-[13px] text-bone placeholder:text-muted focus:outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear"
                className="mono text-[14px] leading-none text-muted transition-colors hover:text-bone"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            className="mono h-9 border border-border bg-panel px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:border-ember hover:text-ember"
          >
            Read
          </button>
        </form>

        <div className="flex items-center border border-border">
          {(['mainnet', 'testnet'] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onNetwork(n)}
              className={clsx(
                'mono px-3 py-2 text-[11px] uppercase tracking-[0.12em] transition-colors',
                network === n ? 'bg-panel-2 text-ember' : 'text-muted hover:text-bone-dim',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
