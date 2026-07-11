import type { Script, ScriptCategory } from '@/domain/types'
import { unknownScriptLabel } from '@/registry/registry'

/**
 * A decoded or unrecognized script tag, used on every cell. A recognized script
 * shows a category pill and its short name; an unrecognized script shows a
 * shortened code hash marked unrecognized — never a guess (SPEC §7.4).
 */
export function ScriptTag({ script, category }: { script: Script; category: ScriptCategory }) {
  const label = category === 'lock' ? 'LOCK' : 'TYPE'
  const known = script.known

  if (!known) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="mono inline-flex h-[18px] items-center border border-[color:var(--color-alarm)]/40 bg-panel px-[9px] text-[9px] uppercase leading-none tracking-[0.14em] text-muted">
          {label}
        </span>
        <span className="mono text-[11px] text-bone-dim">{unknownScriptLabel(script)}</span>
        <span className="mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--color-alarm)]">
          unrecognized
        </span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="mono inline-flex h-[18px] items-center border border-border bg-panel-2 px-[9px] text-[9px] uppercase leading-none tracking-[0.14em] text-muted">
        {label}
      </span>
      <span className="mono text-[11px] text-bone">{known.shortName}</span>
    </span>
  )
}
