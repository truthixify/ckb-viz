import { useEffect, useState } from 'react'
import { getCustomEndpoint, getRpcUrl, isValidEndpoint, setRpcUrl } from '@/app/config'
import type { Network } from '@/domain/types'

/**
 * Point the tool at a custom CKB node for a network (SPEC §6.6). The endpoint is
 * validated (a pasted URL is a request-forgery vector) and persisted; saving
 * reloads so the new source and caches take effect cleanly.
 */
export function EndpointSettings({ network, onClose }: { network: Network; onClose: () => void }) {
  const [value, setValue] = useState(getCustomEndpoint(network) ?? '')
  const trimmed = value.trim()
  const invalid = trimmed !== '' && !isValidEndpoint(trimmed)
  const hasCustom = getCustomEndpoint(network) !== null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    if (invalid) return
    setRpcUrl(network, trimmed || null)
    window.location.reload()
  }
  const reset = () => {
    setRpcUrl(network, null)
    window.location.reload()
  }

  return (
    <div className="absolute right-0 top-full z-40 mt-2 flex w-[360px] max-w-[90vw] flex-col gap-3 border border-border bg-panel-2 p-4">
      <div className="flex items-center justify-between">
        <span className="meta-label">{network} endpoint</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="mono text-[14px] leading-none text-muted hover:text-bone"
        >
          ×
        </button>
      </div>
      <span className="mono break-all text-[10px] text-muted">Active · {getRpcUrl(network)}</span>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex flex-col gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="https://your-node…"
          aria-label="Custom RPC endpoint"
          className="mono h-9 border border-border bg-inset px-3 text-[12px] text-bone placeholder:text-muted focus:border-ember focus:outline-none"
        />
        {invalid && (
          <span className="mono text-[10px] text-[color:var(--color-alarm)]">
            Enter a valid http(s) or ws(s) URL.
          </span>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={invalid}
            className="mono h-8 border border-border bg-panel px-3 text-[10px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-ember hover:text-ember disabled:opacity-40"
          >
            Save & reload
          </button>
          {hasCustom && (
            <button
              type="button"
              onClick={reset}
              className="mono h-8 border border-border bg-panel px-3 text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-bone-dim"
            >
              Reset to default
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
