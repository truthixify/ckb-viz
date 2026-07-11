import { clsx } from '@/app/clsx'
import type { Cell } from '@/domain/types'
import { ckbParts, formatOutPoint } from '@/domain/units'
import { ScriptTag } from './ScriptTag'
import type { CellSide } from './types'

interface CellCardProps {
  cell: Cell
  side: CellSide
  /** Output index, shown as "#0". */
  index?: number | undefined
  id: string
  active: boolean
  selected: boolean
  onActivate: (id: string | null) => void
  onSelect: (cell: Cell, id: string) => void
  registerRef: (id: string, el: HTMLElement | null) => void
  onCopy: (text: string) => void
}

/**
 * A cell card (SPEC §9.3): capacity prominent, lock/type tags, a data
 * indicator, a copyable out-point, and a side marker tinting it as consumed
 * (input, blue) or created (output, green). Focusable and selectable — the
 * keyboard equivalent of hover, opening the detail panel on Enter/Space.
 */
export function CellCard(props: CellCardProps) {
  const { cell, side, index, id, active, selected, onActivate, onSelect, registerRef, onCopy } = props
  const isOutput = side === 'output'
  const { int, frac } = ckbParts(cell.capacity)
  const decoded = cell.decoded
  const outPoint = cell.outPoint ? formatOutPoint(cell.outPoint) : undefined

  return (
    <div
      ref={(el) => registerRef(id, el)}
      data-flow-cell
      role="button"
      tabIndex={0}
      aria-label={`${isOutput ? `Output ${index}` : 'Input'} cell, ${int} CKB, ${
        cell.lock.known?.shortName ?? 'unrecognized'
      } lock${cell.type ? `, ${cell.type.known?.shortName ?? 'unrecognized'} type` : ''}${
        cell.decoded && cell.decoded.kind !== 'empty' ? `, ${cell.decoded.label}` : ''
      }. Activate to open detail.`}
      onMouseEnter={() => onActivate(id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(id)}
      onBlur={() => onActivate(null)}
      onClick={() => onSelect(cell, id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(cell, id)
        }
      }}
      className={clsx(
        'relative flex flex-col gap-3.5 border bg-panel px-5 py-4 transition-colors duration-150',
        isOutput ? 'items-end text-right' : 'items-start text-left',
        selected
          ? 'border-[color:var(--color-ember)]'
          : active
            ? 'border-border bg-raised'
            : 'border-hairline',
      )}
    >
      {/* Side marker: consumed (blue) on the left, created (green) on the right. */}
      <span
        aria-hidden
        className={clsx(
          'absolute inset-y-0 w-[3px]',
          isOutput ? 'right-0' : 'left-0',
        )}
        style={{
          backgroundColor: isOutput ? 'var(--color-flow-out)' : 'var(--color-flow-in)',
          opacity: active || selected ? 1 : 0.55,
        }}
      />

      <div className="flex w-full items-center justify-between gap-4">
        {isOutput ? (
          <>
            <span className="mono text-[10px] text-muted">#{index}</span>
            <span className="meta-label">Output</span>
          </>
        ) : (
          <>
            <span className="meta-label">Input</span>
            {outPoint && (
              <button
                type="button"
                className="mono copyable text-[10px] text-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  if (cell.outPoint) onCopy(`${cell.outPoint.txHash}:${cell.outPoint.index}`)
                }}
                title="Copy out-point"
              >
                {outPoint}
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="mono text-[28px] font-medium leading-none tracking-tight text-bone">
          {int}
          {frac && <span className="text-bone-dim">.{frac}</span>}
        </span>
        <span className="mono text-[11px] uppercase tracking-[0.1em] text-muted">CKB</span>
      </div>

      <div className={clsx('flex flex-col gap-1.5', isOutput && 'items-end')}>
        <ScriptTag script={cell.lock} category="lock" />
        {cell.type && <ScriptTag script={cell.type} category="type" />}
      </div>

      {decoded?.imageDataUri && (
        <img
          src={decoded.imageDataUri}
          alt={decoded.contentType ?? 'Spore content'}
          className="h-16 w-16 border border-hairline bg-inset object-contain"
        />
      )}
      {decoded && decoded.kind === 'empty' ? (
        <span className="meta-label">No data</span>
      ) : decoded ? (
        <span
          title={decoded.label}
          className={clsx(
            'mono block max-w-[220px] truncate text-[11px] text-bone-dim',
            decoded.inferred && 'inferred',
          )}
        >
          {decoded.label}
        </span>
      ) : null}
    </div>
  )
}
