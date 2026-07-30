import type { CapacityBreakdown, Cell, Transaction } from '@/domain/types'
import { formatCkb, formatFee, formatInt, truncateHash } from '@/domain/units'
import { bezierPath } from '@/components/flow/connectors'

/**
 * Build a self-contained SVG of a transaction's flow (SPEC §9.11), for export.
 * Drawn from the model, not the live DOM, so it is deterministic and testable:
 * three columns of cell cards feeding a central spine, ember connectors, and a
 * caption. Every colour is an inline literal and the font is a system-mono
 * stack, so the file has zero external references and renders under a strict
 * CSP (and inside a downloaded PNG). On-chain text is escaped, never injected.
 */

const C = {
  base: '#0c0b0a',
  panel: '#141312',
  hairline: '#2a2724',
  border: '#3c3835',
  bone: '#f2eee6',
  boneDim: '#a8a199',
  muted: '#8a827a',
  ember: '#ff5a1f',
  flowIn: '#4aa8ff',
  flowOut: '#54d6a0',
}
const FONT = "'SF Mono', ui-monospace, 'DejaVu Sans Mono', Menlo, monospace"

const CARD_W = 250
const CARD_H = 60
const GAP = 16
const PAD_TOP = 96
const PAD_BOTTOM = 64
const SIDE_PAD = 28
const WIDTH = 1100
const MAX_ROWS = 8

interface Row {
  title: string
  sub: string
  tint: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cellRow(cell: Cell | undefined, tint: string): Row {
  if (!cell) return { title: 'unresolved', sub: 'capacity not known', tint: C.muted }
  const lock = cell.lock.known?.shortName ?? 'Unrecognized'
  const type = cell.type?.known?.shortName ?? (cell.type ? 'type script' : '')
  return { title: `${formatCkb(cell.capacity)} CKB`, sub: type ? `${lock} · ${type}` : lock, tint }
}

/** Cap a side to MAX_ROWS, folding the overflow into one summary row. */
function toRows(cells: (Cell | undefined)[], tint: string, resolved: boolean): Row[] {
  if (cells.length <= MAX_ROWS) return cells.map((c) => cellRow(c, tint))
  const shown = cells.slice(0, MAX_ROWS - 1).map((c) => cellRow(c, tint))
  const rest = cells.slice(MAX_ROWS - 1)
  const sum = rest.reduce((a, c) => a + (c?.capacity ?? 0n), 0n)
  shown.push({
    title: `+${formatInt(rest.length)} more cells`,
    sub: resolved ? `Σ ${formatCkb(sum)} CKB` : 'capacity not resolved',
    tint: C.muted,
  })
  return shown
}

function card(x: number, y: number, row: Row, align: 'start' | 'end'): string {
  const tx = align === 'end' ? x + CARD_W - 14 : x + 14
  const anchor = align === 'end' ? 'end' : 'start'
  return `
    <g>
      <rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" fill="${C.panel}" stroke="${C.border}" stroke-width="1"/>
      <rect x="${align === 'end' ? x + CARD_W - 3 : x}" y="${y}" width="3" height="${CARD_H}" fill="${row.tint}"/>
      <text x="${tx}" y="${y + 26}" fill="${C.bone}" font-family="${FONT}" font-size="16" text-anchor="${anchor}">${esc(row.title)}</text>
      <text x="${tx}" y="${y + 45}" fill="${C.muted}" font-family="${FONT}" font-size="11" text-anchor="${anchor}">${esc(row.sub)}</text>
    </g>`
}

export function buildFlowSvg(transaction: Transaction, capacity: CapacityBreakdown): string {
  const inputsResolved = transaction.inputs.length > 0 && transaction.inputs.every((i) => i.cell)
  const inputCells = transaction.inputs.map((i) => i.cell)
  const inRows = toRows(inputCells, C.flowIn, inputsResolved)
  const outRows = toRows(transaction.outputs, C.flowOut, true)

  const maxRows = Math.max(inRows.length, outRows.length, 3)
  const rowsHeight = maxRows * (CARD_H + GAP) - GAP
  const height = PAD_TOP + rowsHeight + PAD_BOTTOM

  const leftX = SIDE_PAD
  const rightX = WIDTH - SIDE_PAD - CARD_W
  const spineW = 230
  const spineX = (WIDTH - spineW) / 2
  const spineH = 132
  const spineY = PAD_TOP + rowsHeight / 2 - spineH / 2

  const cardY = (rows: Row[], i: number): number => {
    // Vertically center each side's stack within the rows area.
    const stackH = rows.length * (CARD_H + GAP) - GAP
    const top = PAD_TOP + (rowsHeight - stackH) / 2
    return top + i * (CARD_H + GAP)
  }

  const connectors: string[] = []
  inRows.forEach((_, i) => {
    const y = cardY(inRows, i) + CARD_H / 2
    const anchorY = spineY + ((i + 0.5) / inRows.length) * spineH
    const d = bezierPath({ x: leftX + CARD_W, y }, { x: spineX, y: anchorY })
    connectors.push(`<path d="${d}" fill="none" stroke="${C.ember}" stroke-width="1.4" opacity="0.6"/>`)
  })
  outRows.forEach((_, i) => {
    const y = cardY(outRows, i) + CARD_H / 2
    const anchorY = spineY + ((i + 0.5) / outRows.length) * spineH
    const d = bezierPath({ x: spineX + spineW, y: anchorY }, { x: rightX, y })
    connectors.push(`<path d="${d}" fill="none" stroke="${C.ember}" stroke-width="1.4" opacity="0.6"/>`)
  })

  const cards = [
    ...inRows.map((r, i) => card(leftX, cardY(inRows, i), r, 'start')),
    ...outRows.map((r, i) => card(rightX, cardY(outRows, i), r, 'end')),
  ]

  const feeText = capacity.fee === undefined ? 'fee not resolved' : `Fee ${formatFee(capacity.fee)}`
  const spine = `
    <g>
      <rect x="${spineX}" y="${spineY}" width="${spineW}" height="${spineH}" fill="${C.panel}" stroke="${C.ember}" stroke-width="1"/>
      <text x="${spineX + spineW / 2}" y="${spineY + 34}" fill="${C.muted}" font-family="${FONT}" font-size="10" letter-spacing="1.5" text-anchor="middle">TRANSACTION</text>
      <text x="${spineX + spineW / 2}" y="${spineY + 60}" fill="${C.bone}" font-family="${FONT}" font-size="15" text-anchor="middle">${esc(truncateHash(transaction.hash, 8, 6))}</text>
      <text x="${spineX + spineW / 2}" y="${spineY + 88}" fill="${C.ember}" font-family="${FONT}" font-size="13" text-anchor="middle">${esc(feeText)}</text>
      <text x="${spineX + spineW / 2}" y="${spineY + 110}" fill="${C.muted}" font-family="${FONT}" font-size="12" text-anchor="middle">${formatInt(transaction.inputs.length)} in → ${formatInt(transaction.outputs.length)} out</text>
    </g>`

  const caption = `
    <text x="${SIDE_PAD}" y="42" fill="${C.bone}" font-family="${FONT}" font-size="18">${esc(truncateHash(transaction.hash, 12, 10))}</text>
    <text x="${SIDE_PAD}" y="66" fill="${C.muted}" font-family="${FONT}" font-size="12">${transaction.network} · ${feeText.toLowerCase()}</text>
    <text x="${WIDTH - SIDE_PAD}" y="42" fill="${C.muted}" font-family="${FONT}" font-size="12" text-anchor="end">ckb-viz</text>
    <text x="${SIDE_PAD}" y="${height - 24}" fill="${C.muted}" font-family="${FONT}" font-size="10" letter-spacing="1.5">INPUTS</text>
    <text x="${WIDTH - SIDE_PAD}" y="${height - 24}" fill="${C.muted}" font-family="${FONT}" font-size="10" letter-spacing="1.5" text-anchor="end">OUTPUTS</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}">
    <rect x="0" y="0" width="${WIDTH}" height="${height}" fill="${C.base}"/>
    <line x1="${SIDE_PAD}" y1="78" x2="${WIDTH - SIDE_PAD}" y2="78" stroke="${C.hairline}" stroke-width="1"/>
    ${caption}
    ${connectors.join('')}
    ${cards.join('')}
    ${spine}
  </svg>`
}
