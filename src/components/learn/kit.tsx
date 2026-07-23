/**
 * The illustrated vocabulary for the /learn walkthrough.
 *
 * The metaphor, stated once so every scene obeys it:
 *   - A PIGGY BANK (Wallet) is a person's wallet — one per person, it holds
 *     everything they own and persists across a payment. It is never destroyed
 *     to spend money; it is the stage, not the token.
 *   - A COIN (CellCoin) is one cell — one UTXO. It carries a value (its
 *     capacity), a lock (who can spend it) and optionally a type (a token).
 *     Spending consumes coins and mints new ones; a new UTXO is a new COIN
 *     dropped into a wallet, never a new piggy bank.
 * On-brand throughout: squared, ember, the flow tints as role markers only
 * (blue = input/consumed, green = output/created, red = rejected).
 */

const fmtCoin = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })

const ownerColor = (o?: 'A' | 'B') => (o === 'B' ? 'var(--color-bone-dim)' : 'var(--color-ember)')

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
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, ...style }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="color-mix(in oklab, var(--color-panel) 88%, transparent)" stroke={color} strokeWidth="2" />
        <circle cx="24" cy="19" r="7.5" fill="none" stroke={color} strokeWidth="2" />
        <path d="M12 39 a12 10 0 0 1 24 0" fill="none" stroke={color} strokeWidth="2" />
      </svg>
      <span className="mono text-[11px] font-medium" style={{ color }}>
        {name}
      </span>
    </div>
  )
}

/**
 * A coin — one cell, one UTXO. `value` is its capacity; `owner` drives a small
 * padlock badge (whose key spends it); `type` stamps a token on its face;
 * `role` tints the rim as a marker (input = blue, output = green); `consumed`
 * shows it destroyed at a transaction (struck through, desaturated).
 */
export function CellCoin({
  value,
  owner,
  type,
  role,
  consumed = false,
  size = 44,
  showValue = true,
  showBadge = true,
  className,
  style,
}: {
  value?: number
  owner?: 'A' | 'B'
  type?: string
  role?: 'input' | 'output'
  consumed?: boolean
  size?: number
  showValue?: boolean
  showBadge?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const rim = consumed
    ? 'var(--color-muted)'
    : role === 'input'
      ? 'var(--color-flow-in)'
      : role === 'output'
        ? 'var(--color-flow-out)'
        : 'color-mix(in oklab, var(--color-ember) 45%, var(--color-bone))'
  const body = consumed ? 'color-mix(in oklab, var(--color-muted) 22%, var(--color-panel))' : 'var(--color-ember)'
  const oc = ownerColor(owner)

  return (
    <span
      className={className}
      aria-hidden
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, opacity: consumed ? 0.55 : 1, ...style }}
    >
      <svg width={size} height={size} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill={body} stroke={rim} strokeWidth="2.5" />
        <circle cx="22" cy="22" r="15.5" fill="none" stroke="color-mix(in oklab, var(--color-base) 40%, transparent)" strokeWidth="1" />
        {consumed && <line x1="8" y1="8" x2="36" y2="36" stroke="var(--color-alarm)" strokeWidth="2" />}
      </svg>
      {showValue && value !== undefined && (
        <span
          className="mono font-medium"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.24),
            color: consumed ? 'var(--color-muted)' : 'var(--color-base)',
          }}
        >
          {fmtCoin(value)}
        </span>
      )}
      {type && (
        <span style={{ position: 'absolute', top: -Math.round(size * 0.12), left: '50%', transform: 'translateX(-50%)' }}>
          <Stamp label={type} color={role === 'output' ? 'var(--color-flow-out)' : 'var(--color-ember)'} />
        </span>
      )}
      {showBadge && owner && (
        <span
          className="mono"
          style={{
            position: 'absolute',
            bottom: -Math.round(size * 0.1),
            right: -Math.round(size * 0.1),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            padding: '1px 2px',
            background: 'var(--color-panel)',
            border: `1px solid ${oc}`,
            color: oc,
            fontSize: Math.round(size * 0.2),
            lineHeight: 1,
          }}
        >
          <Padlock size={Math.round(size * 0.26)} color={oc} />
          {owner}
        </span>
      )}
    </span>
  )
}

/**
 * A wallet — a piggy bank holding a person's coins. One per person; it persists.
 * `coins` are the values of the cells inside; the total is their live sum.
 */
export function Wallet({
  owner,
  ownerLetter,
  color,
  coins,
  size = 128,
  showValues = false,
  coinRole,
  receiveKey,
  emptyLabel,
  className,
}: {
  owner: string
  ownerLetter?: 'A' | 'B'
  color: string
  coins: number[]
  size?: number
  showValues?: boolean
  coinRole?: 'input' | 'output'
  receiveKey?: number
  emptyLabel?: string
  className?: string
}) {
  const total = coins.reduce((a, b) => a + b, 0)
  const coinSize = showValues ? Math.max(32, Math.round(size * 0.3)) : Math.round(size * 0.22)
  const bodyH = (size * 56) / 72

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: bodyH }}>
        <PiggyBank size={size} color={color} />
        <div
          key={receiveKey}
          style={{
            position: 'absolute',
            left: '22%',
            top: '22%',
            width: '56%',
            height: '54%',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: showValues ? 4 : 2,
            animationName: receiveKey ? 'piggy-receive' : undefined,
            animationDuration: '260ms',
            animationTimingFunction: 'cubic-bezier(.2,.6,.3,1)',
          }}
        >
          {coins.length === 0 && emptyLabel ? (
            <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">{emptyLabel}</span>
          ) : (
            coins.map((v, k) => (
              <CellCoin
                key={k}
                value={v}
                {...(ownerLetter ? { owner: ownerLetter } : {})}
                showValue={showValues}
                showBadge={showValues}
                {...(coinRole ? { role: coinRole } : {})}
                size={coinSize}
              />
            ))
          )}
        </div>
      </div>
      <span className="meta-label-sm">{owner}</span>
      <span className="mono text-[14px] font-medium text-bone">
        {fmtCoin(total)} <span className="text-[9px] uppercase tracking-[0.1em] text-muted">CKB</span>
      </span>
    </div>
  )
}

/**
 * A piggy bank — a person's wallet. It holds coins; it is never smashed to pay.
 * (Its cut-away belly is where the Wallet component overlays the coins.)
 */
export function PiggyBank({
  size = 96,
  color = 'var(--color-ember)',
  className,
  style,
}: {
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}) {
  const fill = 'color-mix(in oklab, var(--color-ember) 8%, var(--color-panel))'
  return (
    <svg width={size} height={(size * 56) / 72} viewBox="0 0 72 56" fill="none" aria-hidden className={className} style={style}>
      <rect x="20" y="42" width="5" height="9" fill={fill} stroke={color} strokeWidth="2" />
      <rect x="45" y="42" width="5" height="9" fill={fill} stroke={color} strokeWidth="2" />
      <ellipse cx="37" cy="28" rx="26" ry="17" fill={fill} stroke={color} strokeWidth="2" />
      <path d="M40 12 l7 -7 l2 10 z" fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="12" cy="30" rx="8" ry="9" fill={fill} stroke={color} strokeWidth="2" />
      <circle cx="10" cy="28" r="1.1" fill={color} />
      <circle cx="10" cy="33" r="1.1" fill={color} />
      <circle cx="24" cy="23" r="1.6" fill={color} />
      <rect x="34" y="14" width="16" height="3" rx="1" fill="var(--color-base)" stroke={color} strokeWidth="1.4" />
      <path d="M62 25 q6 -1 4 5 q-2 4 -6 1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden className={className} style={style}>
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

/**
 * The lifecycle traveller — a sealed transaction packet (not a loose coin).
 * A squared card bearing a seal; `validated` shows a green check, `rejected` a
 * red cross.
 */
export function TxPacket({ size = 40, validated = false, rejected = false, className, style }: {
  size?: number
  validated?: boolean
  rejected?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const tint = rejected ? 'var(--color-alarm)' : validated ? 'var(--color-flow-out)' : 'var(--color-ember)'
  const glyph = rejected ? '✕' : validated ? '✓' : '≣'
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: Math.round(size * 0.82),
        border: `2px solid ${tint}`,
        background: 'var(--color-panel)',
        color: tint,
        ...style,
      }}
    >
      <span className="mono" style={{ fontSize: Math.round(size * 0.4), lineHeight: 1 }}>{glyph}</span>
    </span>
  )
}
