/**
 * The illustrated vocabulary for the /learn walkthrough: people (Avatar), a
 * round CkbCoin, the PiggyBank that stands in for a cell, a Padlock (the lock
 * script), and a type Stamp. Deliberately on-brand — squared, ember, the flow
 * tints — so the walkthrough and the real visualizer read as one language.
 */

/** A friendly person avatar — Alice, Bob — for the transaction walkthrough. */
export function Avatar({
  name,
  color,
  size = 64,
  className,
  style,
}: {
  name: string
  color: string
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  const initial = name.slice(0, 1).toUpperCase()
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, ...style }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="color-mix(in oklab, var(--color-panel) 88%, transparent)" stroke={color} strokeWidth="2" />
        <circle cx="24" cy="19" r="7.5" fill="none" stroke={color} strokeWidth="2" />
        <path d="M12 39 a12 10 0 0 1 24 0" fill="none" stroke={color} strokeWidth="2" />
        <text x="24" y="27.5" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill={color} opacity="0">
          {initial}
        </text>
      </svg>
      <span className="mono text-[11px] font-medium" style={{ color }}>
        {name}
      </span>
    </div>
  )
}

/** A round CKB coin, for the piggy-bank scenes. */
export function CkbCoin({ size = 22, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} style={style}>
      <circle cx="12" cy="12" r="10.5" fill="var(--color-ember)" stroke="color-mix(in oklab, var(--color-ember) 45%, var(--color-bone))" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="color-mix(in oklab, var(--color-ember) 30%, var(--color-base))" strokeWidth="1" />
      <rect x="10.6" y="6.5" width="2.8" height="11" transform="rotate(45 12 12)" fill="var(--color-base)" opacity="0.85" />
    </svg>
  )
}

/**
 * A piggy bank — the friendly stand-in for a cell. It holds coins, has a slot to
 * drop them in, and a lock; to spend, you break it open. `broken` cracks it.
 */
export function PiggyBank({
  size = 96,
  color = 'var(--color-ember)',
  broken = false,
  className,
  style,
}: {
  size?: number
  color?: string
  broken?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const fill = 'color-mix(in oklab, var(--color-ember) 10%, var(--color-panel))'
  return (
    <svg width={size} height={(size * 56) / 72} viewBox="0 0 72 56" fill="none" aria-hidden className={className} style={style}>
      {/* legs */}
      <rect x="20" y="42" width="5" height="9" fill={fill} stroke={color} strokeWidth="2" />
      <rect x="45" y="42" width="5" height="9" fill={fill} stroke={color} strokeWidth="2" />
      {/* body */}
      <ellipse cx="37" cy="28" rx="26" ry="17" fill={fill} stroke={color} strokeWidth="2" />
      {/* ear */}
      <path d="M40 12 l7 -7 l2 10 z" fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* snout */}
      <ellipse cx="12" cy="30" rx="8" ry="9" fill={fill} stroke={color} strokeWidth="2" />
      <circle cx="10" cy="28" r="1.1" fill={color} />
      <circle cx="10" cy="33" r="1.1" fill={color} />
      {/* eye */}
      <circle cx="24" cy="23" r="1.6" fill={color} />
      {/* coin slot */}
      <rect x="34" y="14" width="16" height="3" rx="1" fill="var(--color-base)" stroke={color} strokeWidth="1.4" />
      {/* tail */}
      <path d="M62 25 q6 -1 4 5 q-2 4 -6 1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* crack when broken */}
      {broken && (
        <path
          d="M30 12 l4 8 l-5 5 l6 6 l-4 8"
          fill="none"
          stroke="var(--color-alarm)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
    </svg>
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

