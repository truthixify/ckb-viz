import { clsx } from '@/app/clsx'

/**
 * The illustrated vocabulary for the /learn primer: a Coin (a unit of value), a
 * Cell (the box that holds it), a Padlock (the lock script), and a type Stamp.
 * Deliberately on-brand — squared, ember, the flow tints — so the primer and the
 * real visualizer read as one language.
 */

type Tone = 'input' | 'output' | 'neutral' | 'ember'

const toneColor: Record<Tone, string> = {
  input: 'var(--color-flow-in)',
  output: 'var(--color-flow-out)',
  neutral: 'var(--color-border)',
  ember: 'var(--color-ember)',
}

/** A unit of value — a small squared "coin" (a tilted square) in ember. */
export function Coin({ size = 16, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        transform: 'rotate(45deg)',
        background: 'var(--color-ember)',
        border: '1.5px solid color-mix(in oklab, var(--color-ember) 40%, var(--color-bone))',
        ...style,
      }}
    />
  )
}

/** A padlock — the lock script. `open` swings the shackle up. */
export function Padlock({
  size = 20,
  open = false,
  color = 'var(--color-bone-dim)',
  className,
  style,
}: {
  size?: number
  open?: boolean
  color?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      style={style}
    >
      <path
        d={open ? 'M6 9 V6 a4 4 0 0 1 8 0' : 'M6 9 V6 a4 4 0 0 1 8 0 V9'}
        stroke={color}
        strokeWidth="1.6"
        style={{ transformOrigin: '14px 6px', transform: open ? 'rotate(-24deg)' : 'none', transition: 'transform 200ms var(--ease-instrument)' }}
      />
      <rect x="4" y="9" width="12" height="8" stroke={color} strokeWidth="1.6" fill="var(--color-panel-2)" />
      <rect x="9.2" y="12" width="1.6" height="3" fill={color} />
    </svg>
  )
}

/** A type stamp — the type script (e.g. a token). */
export function Stamp({ label, color = 'var(--color-ember)' }: { label: string; color?: string }) {
  return (
    <span
      className="mono text-[9px] font-medium uppercase tracking-[0.12em]"
      style={{
        color,
        border: `1px solid ${color}`,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
        padding: '2px 6px',
      }}
    >
      {label}
    </span>
  )
}

export interface CellProps {
  /** Capacity label, e.g. "100". */
  capacity?: string | number
  /** Owner / name shown small at the top, e.g. "Alice". */
  owner?: string
  locked?: boolean
  lockOpen?: boolean
  type?: string
  tone?: Tone
  /** Coins to render inside as a value indicator. */
  coins?: number
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

/** A cell — the box that holds capacity, a lock, and optionally a type + data. */
export function Cell({
  capacity,
  owner,
  locked = false,
  lockOpen = false,
  type,
  tone = 'neutral',
  className,
  style,
  children,
}: CellProps) {
  return (
    <div
      className={clsx('relative flex min-w-[150px] flex-col gap-2 bg-panel px-4 py-3', className)}
      style={{ border: '1px solid var(--color-hairline)', borderLeft: `3px solid ${toneColor[tone]}`, ...style }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="meta-label-sm">{owner ?? 'Cell'}</span>
        {locked && <Padlock size={18} open={lockOpen} color={toneColor[tone === 'neutral' ? 'ember' : tone]} />}
      </div>
      {capacity !== undefined && (
        <span className="flex items-baseline gap-1.5">
          <span className="mono text-[24px] font-medium leading-none tracking-tight text-bone">{capacity}</span>
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">CKB</span>
        </span>
      )}
      {type && (
        <span>
          <Stamp label={type} color={toneColor[tone === 'input' ? 'input' : 'output']} />
        </span>
      )}
      {children}
    </div>
  )
}
