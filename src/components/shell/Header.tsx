import { useEffect, useRef, useState } from 'react'
import { clsx } from '@/app/clsx'
import type { Network } from '@/domain/types'
import { BrandMark } from '../brand/BrandMark'
import { EndpointSettings } from './EndpointSettings'

/**
 * The top bar (SPEC §9.1): the brand mark (Home), the hash input with a clear
 * affordance and READ, and the network selector. On a narrow viewport the hash
 * input drops to its own full-width row below the brand and controls.
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!settingsWrapRef.current?.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [settingsOpen])

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
      <BrandMark onHome={onHome} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="order-last flex w-full items-center gap-3 min-[760px]:order-none min-[760px]:w-auto min-[760px]:flex-1 min-[760px]:justify-center"
      >
        <div className="flex h-9 w-full items-center gap-2 border border-border bg-inset px-3 focus-within:border-ember min-[760px]:w-[440px]">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste a transaction hash or address…"
            aria-label="Transaction hash or address"
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
          className="mono h-9 shrink-0 border border-border bg-panel px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:border-ember hover:text-ember"
        >
          Read
        </button>
      </form>

      <div className="flex items-center gap-3">
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

        <div ref={settingsWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Endpoint settings"
            aria-expanded={settingsOpen}
            className={clsx(
              'mono flex h-9 items-center border border-border px-2.5 text-[13px] transition-colors',
              settingsOpen ? 'text-ember' : 'text-muted hover:text-bone-dim',
            )}
          >
            ⚙
          </button>
          {settingsOpen && (
            <EndpointSettings network={network} onClose={() => setSettingsOpen(false)} />
          )}
        </div>
      </div>
    </header>
  )
}
