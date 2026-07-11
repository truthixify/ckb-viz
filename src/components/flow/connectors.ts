export interface Point {
  x: number
  y: number
}

export interface Connector {
  id: string
  side: 'input' | 'output'
  d: string
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

/** Evenly distribute N anchor points across a vertical edge of height `height`. */
export function distributeY(top: number, height: number, count: number, index: number): number {
  return top + (height * (index + 1)) / (count + 1)
}
