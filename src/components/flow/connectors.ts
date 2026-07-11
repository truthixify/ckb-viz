export interface Point {
  x: number
  y: number
}

export interface Connector {
  id: string
  side: 'input' | 'output' | 'dep'
  d: string
}

/** Distribute N anchor points across a horizontal edge of width `width`. */
export function distributeX(left: number, width: number, count: number, index: number): number {
  return left + (width * (index + 1)) / (count + 1)
}

/**
 * A vertical connector for the stacked narrow layout — vertical tangents at
 * both ends, so the stream enters and leaves flat against a top/bottom edge.
 */
export function vBezierPath(start: Point, end: Point, curviness = 0.5): string {
  const dy = Math.max(22, Math.abs(end.y - start.y) * curviness)
  return `M ${round(start.x)} ${round(start.y)} C ${round(start.x)} ${round(start.y + dy)}, ${round(end.x)} ${round(end.y - dy)}, ${round(end.x)} ${round(end.y)}`
}

/**
 * A single cubic-bezier connector with horizontal tangents at both ends, so the
 * stream enters and leaves each anchor flat against the edge (SPEC §10.5).
 * Control points are offset by `curviness` of the horizontal span.
 */
export function bezierPath(start: Point, end: Point, curviness = 0.45): string {
  const dx = (end.x - start.x) * curviness
  return `M ${round(start.x)} ${round(start.y)} C ${round(start.x + dx)} ${round(start.y)}, ${round(end.x - dx)} ${round(end.y)}, ${round(end.x)} ${round(end.y)}`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * A dep connector: a vertical S-curve from a dep card's top up to the spine's
 * bottom edge, with vertical tangents at both ends (SPEC §9.2, design geometry).
 */
export function depCurve(depCx: number, depTop: number, sx: number, spineBottom: number): string {
  const k = Math.max(24, Math.abs(depTop - spineBottom) * 0.5)
  return `M ${round(depCx)} ${round(depTop)} C ${round(depCx)} ${round(depTop - k)}, ${round(sx)} ${round(spineBottom + k)}, ${round(sx)} ${round(spineBottom)}`
}

/** Evenly distribute N anchor points across a vertical edge of height `height`. */
export function distributeY(top: number, height: number, count: number, index: number): number {
  return top + (height * (index + 1)) / (count + 1)
}
