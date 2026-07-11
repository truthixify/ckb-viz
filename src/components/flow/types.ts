export type CellSide = 'input' | 'output'

export function cellId(side: CellSide, index: number | 'group'): string {
  return `${side === 'input' ? 'in' : 'out'}-${index}`
}
