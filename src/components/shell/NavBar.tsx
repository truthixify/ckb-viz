import { useEffect, useRef, useState } from 'react'
import { clsx } from '@/app/clsx'
import { EXAMPLE_CATEGORIES, examplesForNetwork, type ExampleKind } from '@/app/examples'
import type { Network } from '@/domain/types'

/**
 * The secondary nav (SPEC §9): the app's primary surfaces as tabs — Explore
 * (the viewer), Simulate, Learn — with an ember active underline, and a single
 * "Explore examples" disclosure that groups the example finders by kind. Each
 * finder loads a recent real transaction of that kind, so the menu shows off the
 * decoder's range without cluttering the bar.
 */
export function NavBar({
  network,
  finding,
  onPick,
  simulate,
  onSimulate,
  learn,
  onLearn,
  onExplore,
}: {
  network: Network
  finding: string | null
  onPick: (kindId: string, label: string) => void
  simulate: boolean
  onSimulate: () => void
  learn: boolean
  onLearn: () => void
  onExplore: () => void
}) {
  const kinds = examplesForNetwork(network)
  const explore = !simulate && !learn
  const tabs = [
    { id: 'explore', label: 'Explore', active: explore, onClick: onExplore },
    { id: 'simulate', label: 'Simulate', active: simulate, onClick: onSimulate },
    { id: 'learn', label: 'Learn', active: learn, onClick: onLearn },
  ]

  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-5">
      <nav aria-label="Primary" className="flex items-stretch">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={t.onClick}
            aria-current={t.active ? 'page' : undefined}
            className={clsx(
              'mono border-b-2 px-3 py-3 text-[11px] uppercase tracking-[0.12em] transition-colors',
              t.active ? 'border-ember text-ember' : 'border-transparent text-muted hover:text-bone-dim',
            )}
            style={{ marginBottom: -1 }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {kinds.length > 0 && <ExamplesMenu kinds={kinds} finding={finding} onPick={onPick} />}
    </div>
  )
}

function ExamplesMenu({
  kinds,
  finding,
  onPick,
}: {
  kinds: ExampleKind[]
  finding: string | null
  onPick: (kindId: string, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const groups = EXAMPLE_CATEGORIES.map((c) => ({ ...c, items: kinds.filter((k) => k.category === c.id) })).filter((c) => c.items.length > 0)
  const busy = finding !== null
  const findingLabel = finding ? (kinds.find((k) => k.id === finding)?.label ?? null) : null

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-expanded={open}
        className={clsx(
          'mono flex h-9 items-center gap-2 border px-3 text-[11px] uppercase tracking-[0.12em] transition-colors',
          open ? 'border-ember text-ember' : 'border-border text-bone-dim hover:border-bone-dim hover:text-bone',
          busy && 'opacity-70',
        )}
      >
        {busy ? (
          <span>Finding {findingLabel}…</span>
        ) : (
          <>
            <span>
              <span className="hidden min-[560px]:inline">Explore </span>examples
            </span>
            <span aria-hidden className="text-[8px] leading-none">
              {open ? '▲' : '▼'}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] border border-border bg-panel max-[480px]:left-0 max-[480px]:right-0">
          {groups.map((group) => (
            <div key={group.id} className="border-b border-hairline px-3 py-2.5 last:border-b-0">
              <div className="meta-label-sm mb-1.5">{group.label}</div>
              <div className="flex flex-col">
                {group.items.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      onPick(k.id, k.label)
                      setOpen(false)
                    }}
                    className="mono flex items-center justify-between gap-6 py-1.5 text-left text-[12px] text-bone-dim transition-colors hover:text-ember focus-visible:text-ember"
                  >
                    <span>{k.label}</span>
                    <span aria-hidden className="text-[10px] text-muted">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
