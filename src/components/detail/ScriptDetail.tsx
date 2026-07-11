import type { Script, ScriptCategory } from '@/domain/types'

/**
 * A script's full readout inside the detail panel (SPEC §9.4): the decoded name
 * and what it does, plus code hash, hash type, and args — every hash copyable.
 * An unrecognized script is shown plainly, never guessed.
 */
export function ScriptDetail({
  script,
  category,
  onCopy,
}: {
  script: Script
  category: ScriptCategory
  onCopy: (text: string) => void
}) {
  const known = script.known
  return (
    <div className="flex flex-col gap-3 border border-hairline bg-panel px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="meta-label">{category === 'lock' ? 'Lock script' : 'Type script'}</span>
        {!known && (
          <span className="mono text-[9px] uppercase tracking-[0.12em] text-[color:var(--color-alarm)]">
            unrecognized
          </span>
        )}
      </div>

      <div className="text-[14px] text-bone">{known?.name ?? 'Unrecognized script'}</div>
      {known?.meaning && (
        <p className="text-[12px] leading-relaxed text-bone-dim">{known.meaning}</p>
      )}

      {script.address && <Field label="Address" value={script.address} onCopy={onCopy} />}
      <Field label="Code hash" value={script.codeHash} onCopy={onCopy} />
      <Field label="Hash type" value={script.hashType} />
      <Field label="Args" value={script.args} onCopy={onCopy} />

      {known?.docsUrl && (
        <a
          href={known.docsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mono text-[11px] text-muted underline underline-offset-2 transition-colors hover:text-ember"
        >
          What is this? →
        </a>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy?: (text: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="meta-label-sm">{label}</span>
      {onCopy ? (
        <button
          type="button"
          onClick={() => onCopy(value)}
          title="Copy"
          className="mono copyable break-all text-left text-[11px] text-bone-dim"
        >
          {value}
        </button>
      ) : (
        <span className="mono text-[11px] text-bone-dim">{value}</span>
      )}
    </div>
  )
}
