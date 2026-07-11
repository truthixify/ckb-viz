import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CapacityBreakdown, Cell, Transaction } from '@/domain/types'
import { formatCkb, formatInt } from '@/domain/units'
import { CellCard } from './CellCard'
import { CellDepsLane } from './CellDepsLane'
import { GroupedCell } from './GroupedCell'
import { TransactionSpine } from './TransactionSpine'
import { bezierPath, distributeY, type Connector } from './connectors'
import { cellId, type CellSide } from './types'

const GROUP_THRESHOLD = 4
const GROUP_KEEP = 3

interface Row {
  id: string
  cell?: Cell
  index?: number
  grouped?: { count: number; sum: bigint }
}

/** Split a side's cells into visible rows, collapsing crowded sides. */
function toRows(cells: Cell[], side: CellSide, expanded: boolean): Row[] {
  if (expanded || cells.length <= GROUP_THRESHOLD) {
    return cells.map((cell, index) => ({ id: cellId(side, index), cell, index }))
  }
  const shown = cells.slice(0, GROUP_KEEP).map((cell, index) => ({ id: cellId(side, index), cell, index }))
  const rest = cells.slice(GROUP_KEEP)
  const sum = rest.reduce((a, c) => a + c.capacity, 0n)
  return [...shown, { id: cellId(side, 'group'), grouped: { count: rest.length, sum } }]
}

export function FlowCanvas({
  transaction,
  capacity,
  selectedId,
  onSelectCell,
  onCopy,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  selectedId: string | null
  onSelectCell: (cell: Cell, id: string) => void
  onCopy: (text: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLElement | null>(null)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map())

  const [activeId, setActiveId] = useState<string | null>(null)
  const [inputsExpanded, setInputsExpanded] = useState(false)
  const [outputsExpanded, setOutputsExpanded] = useState(false)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const inputCells = transaction.inputs.map(
    (i) => i.cell ?? unresolvedCell(),
  )
  const inputRows = toRows(inputCells, 'input', inputsExpanded)
  const outputRows = toRows(transaction.outputs, 'output', outputsExpanded)
  // Latest rows for the stable measure() to read, without making it a dependency.
  const rowsRef = useRef({ inputRows, outputRows })
  rowsRef.current = { inputRows, outputRows }

  const registerCellRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cellRefs.current.set(id, el)
    else cellRefs.current.delete(id)
  }, [])

  const measure = useCallback(() => {
    const container = containerRef.current
    const spine = spineRef.current
    if (!container || !spine) return
    const c = container.getBoundingClientRect()
    const s = spine.getBoundingClientRect()
    const spineLeft = s.left - c.left
    const spineRight = s.right - c.left
    const spineTop = s.top - c.top
    const { inputRows: inRows, outputRows: outRows } = rowsRef.current

    const next: Connector[] = []
    inRows.forEach((row, k) => {
      const el = cellRefs.current.get(row.id)
      if (!el) return
      const r = el.getBoundingClientRect()
      const start = { x: r.right - c.left, y: r.top - c.top + r.height / 2 }
      const end = { x: spineLeft, y: distributeY(spineTop, s.height, inRows.length, k) }
      next.push({ id: row.id, side: 'input', d: bezierPath(start, end) })
    })
    outRows.forEach((row, k) => {
      const el = cellRefs.current.get(row.id)
      if (!el) return
      const r = el.getBoundingClientRect()
      const start = { x: spineRight, y: distributeY(spineTop, s.height, outRows.length, k) }
      const end = { x: r.left - c.left, y: r.top - c.top + r.height / 2 }
      next.push({ id: row.id, side: 'output', d: bezierPath(start, end) })
    })
    // Bail out when nothing changed so measuring can't cause a render loop.
    setConnectors((prev) => (sameConnectors(prev, next) ? prev : next))
    setSize((prev) => (prev.w === c.width && prev.h === c.height ? prev : { w: c.width, h: c.height }))
  }, [])

  // Re-measure on mount, on structural changes, and on resize / font load.
  useLayoutEffect(() => {
    measure()
  }, [measure, inputsExpanded, outputsExpanded, transaction])

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => measure())
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', measure)
    void document.fonts?.ready.then(() => measure())
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8">
        <span className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-flow-in)' }} />
          Inputs
        </span>
        <span className="meta-label justify-self-center">Transaction</span>
        <span className="mono flex items-center justify-end gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
          Outputs
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-flow-out)' }} />
        </span>
      </div>

      <div ref={containerRef} className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-8">
        {/* Connector overlay above the cell layer. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          fill="none"
          aria-hidden
        >
          {connectors.map((conn) => {
            const isActive = activeId === conn.id
            const dimmed = activeId !== null && !isActive
            return (
              <path
                key={conn.id}
                d={conn.d}
                pathLength={1}
                className="connector"
                stroke="var(--color-ember)"
                strokeWidth={isActive ? 2 : 1.5}
                style={{
                  opacity: isActive ? 1 : dimmed ? 0.1 : 0.42,
                  transition: 'opacity 140ms var(--ease-instrument), stroke-width 140ms var(--ease-instrument)',
                }}
              />
            )
          })}
        </svg>

        <Column align="start">
          {inputRows.map((row) =>
            row.grouped ? (
              <GroupedCell
                key={row.id}
                side="input"
                count={row.grouped.count}
                sumCapacity={row.grouped.sum}
                id={row.id}
                active={activeId === row.id}
                onActivate={setActiveId}
                onExpand={() => setInputsExpanded(true)}
                registerRef={registerCellRef}
              />
            ) : (
              <CellCard
                key={row.id}
                cell={row.cell!}
                side="input"
                id={row.id}
                active={activeId === row.id}
                selected={selectedId === row.id}
                onActivate={setActiveId}
                onSelect={onSelectCell}
                registerRef={registerCellRef}
                onCopy={onCopy}
              />
            ),
          )}
        </Column>

        <div className="w-[300px] max-w-[34vw] justify-self-center">
          <TransactionSpine
            transaction={transaction}
            capacity={capacity}
            registerRef={(el) => (spineRef.current = el)}
            onCopy={onCopy}
          />
        </div>

        <Column align="end">
          {outputRows.map((row) =>
            row.grouped ? (
              <GroupedCell
                key={row.id}
                side="output"
                count={row.grouped.count}
                sumCapacity={row.grouped.sum}
                id={row.id}
                active={activeId === row.id}
                onActivate={setActiveId}
                onExpand={() => setOutputsExpanded(true)}
                registerRef={registerCellRef}
              />
            ) : (
              <CellCard
                key={row.id}
                cell={row.cell!}
                side="output"
                index={row.index}
                id={row.id}
                active={activeId === row.id}
                selected={selectedId === row.id}
                onActivate={setActiveId}
                onSelect={onSelectCell}
                registerRef={registerCellRef}
                onCopy={onCopy}
              />
            ),
          )}
        </Column>
      </div>

      <CellDepsLane cellDeps={transaction.cellDeps} onCopy={onCopy} />

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-8 border-t border-hairline pt-5">
        <CapacityTotal label="Σ Input capacity" value={capacity.inputsTotal} tint="var(--color-flow-in)" align="start" />
        <FeeTotal fee={capacity.fee} />
        <CapacityTotal label="Σ Output capacity" value={capacity.outputsTotal} tint="var(--color-flow-out)" align="end" />
      </div>
    </div>
  )
}

function Column({ align, children }: { align: 'start' | 'end'; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-5 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      {children}
    </div>
  )
}

function CapacityTotal({
  label,
  value,
  tint,
  align,
}: {
  label: string
  value: bigint | undefined
  tint: string
  align: 'start' | 'end'
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${align === 'end' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="mono text-[22px] font-medium tracking-tight" style={{ color: tint }}>
          {value === undefined ? '—' : formatCkb(value)}
        </span>
        <span className="mono text-[11px] text-muted">CKB</span>
      </span>
    </div>
  )
}

function FeeTotal({ fee }: { fee: bigint | undefined }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
        Fee = In − Out
      </span>
      <span className="flex items-baseline justify-center gap-1.5">
        <span className="mono text-[22px] font-medium tracking-tight text-ember">
          {fee === undefined ? '—' : formatCkb(fee)}
        </span>
        <span className="mono text-[11px] text-muted">CKB</span>
      </span>
      {fee !== undefined && (
        <span className="mono text-[10px] text-muted">{formatInt(fee)} shannon</span>
      )}
    </div>
  )
}

function sameConnectors(a: Connector[], b: Connector[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.id !== b[i]!.id || a[i]!.d !== b[i]!.d) return false
  }
  return true
}

function unresolvedCell(): Cell {
  return {
    capacity: 0n,
    occupiedCapacity: 0n,
    lock: { codeHash: '0x' + '0'.repeat(64), hashType: 'type', args: '0x' },
    data: '0x',
    decoded: { kind: 'empty', inferred: false },
  }
}
