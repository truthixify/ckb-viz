import { useState } from 'react'
import type { Transaction } from '@/domain/types'
import { formatInt, truncateHash } from '@/domain/units'
import type { TransactionSource } from '@/source/TransactionSource'
import { useLineageGraph, type LineageNode } from '@/app/useLineageGraph'
import { bezierPath } from '../flow/connectors'

/**
 * A small, bounded lineage graph (SPEC §9.5b): the focus transaction in the
 * centre, its parent transactions to the left, the transactions that spent its
 * outputs to the right. Rendered as plain SVG, so it inherits the furnace look
 * with no graph library. Collapsed by default, so it costs nothing until
 * opened; clicking any node re-centres the graph there.
 */

const CHIP_W = 176
const CHIP_H = 46
const GAP = 16
const COL_GAP = 90
const PAD_Y = 20

export function LineageGraph({
  source,
  focusHash,
  transaction,
  onOpenTx,
}: {
  source: TransactionSource
  focusHash: string | null
  transaction: Transaction | undefined
  onOpenTx: (hash: string) => void
}) {
  const [open, setOpen] = useState(false)
  const graph = useLineageGraph(source, focusHash, transaction, open)

  if (!focusHash || !transaction) return null

  const parents = graph.parents
  const children = graph.children
  const rows = Math.max(parents.length, children.length, 1)
  const height = PAD_Y * 2 + rows * (CHIP_H + GAP) - GAP
  const width = CHIP_W * 3 + COL_GAP * 2

  const leftX = 0
  const centerX = CHIP_W + COL_GAP
  const rightX = (CHIP_W + COL_GAP) * 2

  const colY = (count: number, i: number): number => {
    const stackH = count * (CHIP_H + GAP) - GAP
    return PAD_Y + (height - PAD_Y * 2 - stackH) / 2 + i * (CHIP_H + GAP)
  }
  const focusY = height / 2 - CHIP_H / 2

  return (
    <div className="border-t border-hairline pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-bone-dim"
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        Lineage graph
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="overflow-x-auto">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
              {parents.map((_, i) => (
                <path
                  key={`pe-${i}`}
                  d={bezierPath(
                    { x: leftX + CHIP_W, y: colY(parents.length, i) + CHIP_H / 2 },
                    { x: centerX, y: focusY + CHIP_H / 2 },
                  )}
                  fill="none"
                  stroke="var(--color-ember)"
                  strokeWidth={1.4}
                  opacity={0.55}
                />
              ))}
              {children.map((_, i) => (
                <path
                  key={`ce-${i}`}
                  d={bezierPath(
                    { x: centerX + CHIP_W, y: focusY + CHIP_H / 2 },
                    { x: rightX, y: colY(children.length, i) + CHIP_H / 2 },
                  )}
                  fill="none"
                  stroke="var(--color-ember)"
                  strokeWidth={1.4}
                  opacity={0.55}
                />
              ))}

              {parents.map((node, i) => (
                <Chip key={node.hash} x={leftX} y={colY(parents.length, i)} node={node} role="parent" onOpenTx={onOpenTx} />
              ))}
              {children.map((node, i) => (
                <Chip key={node.hash} x={rightX} y={colY(children.length, i)} node={node} role="child" onOpenTx={onOpenTx} />
              ))}
              <Chip x={centerX} y={focusY} node={{ hash: focusHash }} role="focus" onOpenTx={onOpenTx} />
            </svg>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {graph.parentTotal > parents.length && (
              <span className="mono text-[10px] text-muted">
                +{formatInt(graph.parentTotal - parents.length)} more parent{graph.parentTotal - parents.length === 1 ? '' : 's'} not shown
              </span>
            )}
            {!graph.forwardSupported ? (
              <span className="mono text-[10px] text-muted">Forward lineage needs an indexer source.</span>
            ) : graph.childrenLoading ? (
              <span className="mono text-[10px] text-muted">Looking for spending transactions…</span>
            ) : children.length === 0 ? (
              <span className="mono text-[10px] text-muted">No spending transactions found yet (outputs may be unspent).</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({
  x,
  y,
  node,
  role,
  onOpenTx,
}: {
  x: number
  y: number
  node: LineageNode
  role: 'parent' | 'child' | 'focus'
  onOpenTx: (hash: string) => void
}) {
  const isFocus = role === 'focus'
  return (
    <g
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      onClick={() => !isFocus && onOpenTx(node.hash)}
      onKeyDown={(e) => {
        if (!isFocus && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpenTx(node.hash)
        }
      }}
      style={{ cursor: isFocus ? 'default' : 'pointer' }}
      className={isFocus ? undefined : 'lineage-chip'}
    >
      <rect
        width={CHIP_W}
        height={CHIP_H}
        fill="var(--color-panel)"
        stroke={isFocus ? 'var(--color-ember)' : 'var(--color-border)'}
        strokeWidth={isFocus ? 1.4 : 1}
      />
      <text x={14} y={20} fill="var(--color-muted)" className="mono" fontSize={9} letterSpacing={1.2}>
        {role === 'parent' ? 'PARENT' : role === 'child' ? 'CHILD' : 'THIS TX'}
      </text>
      <text x={14} y={36} fill="var(--color-bone-dim)" className="mono" fontSize={12}>
        {truncateHash(node.hash, 7, 5)}
      </text>
    </g>
  )
}
