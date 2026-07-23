import type { CSSProperties, ReactNode } from 'react'
import { Cell, Coin, Padlock, Stamp } from './kit'

/** Shorthand for a replay-on-mount animation style. */
function anim(name: string, delay = 0, duration = 600, extra: CSSProperties = {}): CSSProperties {
  return { animationName: name, animationDelay: `${delay}ms`, animationDuration: `${duration}ms`, ...extra }
}
const A = 'learn-anim'

function Caption({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <p className={`${A} mono max-w-md text-center text-[11px] leading-relaxed text-muted`} style={anim('learn-rise', delay)}>
      {children}
    </p>
  )
}

/* ── 1 · Intro ──────────────────────────────────────────────────────────── */
function IntroScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute inset-x-0 -top-10 flex justify-center gap-3">
          <Coin size={18} className={A} style={anim('learn-drop', 500, 700)} />
          <Coin size={18} className={A} style={anim('learn-drop', 700, 700)} />
          <Coin size={18} className={A} style={anim('learn-drop', 900, 700)} />
        </div>
        <div className={A} style={anim('learn-pop', 0, 600)}>
          <Cell owner="Alice" capacity="100" tone="ember" locked />
        </div>
      </div>
      <Caption delay={1200}>value lives in a box — a "cell" — locked to its owner</Caption>
    </div>
  )
}

/* ── 2 · UTXO ───────────────────────────────────────────────────────────── */
function UtxoScene() {
  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-6">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <div className={A} style={anim('learn-pop', 0)}>
              <Cell owner="held" capacity="60" tone="input" />
            </div>
            <div className={A} style={anim('learn-pop', 150)}>
              <Cell owner="held" capacity="50" tone="input" />
            </div>
          </div>
          <span className="meta-label-sm">what you hold</span>
        </div>

        <span className="mono text-[20px] text-muted">→</span>

        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <div className={A} style={anim('learn-pop', 700)}>
              <Cell owner="→ Bob" capacity="100" tone="output" />
            </div>
            <div className={A} style={anim('learn-pop', 900)}>
              <Cell owner="change" capacity="9.99" tone="output" />
            </div>
          </div>
          <span className="meta-label-sm">what you create</span>
        </div>
      </div>
      <Caption delay={1200}>
        like Bitcoin's UTXO: you don't edit a balance — you spend whole coins and make new ones (with change)
      </Caption>
    </div>
  )
}

/* ── 3 · The cell (anatomy) ─────────────────────────────────────────────── */
function CellScene() {
  const parts: [string, string, string, number][] = [
    ['capacity', 'the CKB it holds — and the bytes it may store', 'var(--color-bone)', 500],
    ['lock', 'who is allowed to spend it', 'var(--color-ember)', 700],
    ['type', 'the rules on it, e.g. a token', 'var(--color-flow-out)', 900],
    ['data', 'anything else it carries', 'var(--color-bone-dim)', 1100],
  ]
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-8 min-[560px]:gap-12">
        <div className={A} style={anim('learn-pop', 0)}>
          <Cell owner="Alice" capacity="100" tone="ember" locked type="USDI">
            <div className="well mt-1 px-2 py-1">
              <span className="mono text-[9px] text-muted">data · 0x…</span>
            </div>
          </Cell>
        </div>
        <div className="flex flex-col gap-3">
          {parts.map(([name, desc, color, delay]) => (
            <div key={name} className={`${A} flex items-baseline gap-2`} style={anim('learn-rise', delay)}>
              <span className="mono w-2 shrink-0" style={{ color }}>
                ·
              </span>
              <span className="mono text-[11px] font-medium" style={{ color }}>
                {name}
              </span>
              <span className="mono text-[10px] text-muted">— {desc}</span>
            </div>
          ))}
        </div>
      </div>
      <Caption delay={1300}>every cell has four parts — capacity, a lock, an optional type, and data</Caption>
    </div>
  )
}

/* ── 4 · Balance = many cells ───────────────────────────────────────────── */
function BalanceScene() {
  const amounts = ['100', '80', '61', '59']
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-2.5">
        {amounts.map((a, k) => (
          <div key={k} className={A} style={anim('learn-pop', k * 140)}>
            <Cell owner="Alice" capacity={a} tone="ember" locked />
          </div>
        ))}
      </div>
      <div className={`${A} flex items-baseline gap-2`} style={anim('learn-rise', 900)}>
        <span className="meta-label">Balance</span>
        <span className="mono text-[22px] font-medium tracking-tight text-bone">= 300 CKB</span>
      </div>
      <Caption delay={1100}>there is no account — your balance is just the sum of the cells locked to you</Caption>
    </div>
  )
}

/* ── 5 · The transaction ────────────────────────────────────────────────── */
function TransactionScene() {
  const laneCoin = (delay: number, duration = 900) => (
    <Coin
      size={13}
      className={`${A} absolute left-1/2 top-1/2`}
      style={anim('learn-flow-x', delay, duration, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--from' as any]: '-34px',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--to' as any]: '34px',
        marginTop: -6,
      })}
    />
  )
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="grid w-full max-w-[620px] grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-1">
        <div className="flex flex-col gap-2">
          <div className={A} style={anim('learn-dissolve', 1400, 700, { animationFillMode: 'forwards' })}>
            <div style={anim('learn-pop', 0)} className={A}>
              <Cell owner="Alice" capacity="300" tone="input" locked />
            </div>
          </div>
          <div className={A} style={anim('learn-dissolve', 1500, 700, { animationFillMode: 'forwards' })}>
            <div style={anim('learn-pop', 150)} className={A}>
              <Cell owner="Alice" capacity="200" tone="input" locked />
            </div>
          </div>
        </div>

        <div className="relative h-px">
          {laneCoin(500)}
          {laneCoin(750)}
        </div>

        <div className={`${A} flex flex-col items-center gap-1 border px-4 py-4`} style={{ ...anim('learn-pop', 400), borderColor: 'var(--color-ember)' }}>
          <span className="mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-ember)' }}>
            Transaction
          </span>
          <span className="mono text-[10px] text-muted">fee 0.001</span>
        </div>

        <div className="relative h-px">
          {laneCoin(1400)}
          {laneCoin(1650)}
        </div>

        <div className="flex flex-col gap-2">
          <div className={A} style={anim('learn-pop', 1700)}>
            <Cell owner="→ Bob" capacity="450" tone="output" locked />
          </div>
          <div className={A} style={anim('learn-pop', 1850)}>
            <Cell owner="change" capacity="49.99" tone="output" locked />
          </div>
        </div>
      </div>
      <Caption delay={2000}>
        a transaction consumes input cells and creates new ones — value is conserved, minus a small fee
      </Caption>
    </div>
  )
}

/* ── 6 · Lock vs type ───────────────────────────────────────────────────── */
function ScriptsScene() {
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <span className={`${A} flex items-center gap-1.5`} style={anim('learn-reject', 900, 500)}>
              <span className="mono text-[10px]" style={{ color: 'var(--color-alarm)' }}>
                wrong key
              </span>
              <span className="mono text-[14px]" style={{ color: 'var(--color-alarm)' }}>
                ✕
              </span>
            </span>
            <div className={A} style={anim('learn-lock', 300, 700)}>
              <Padlock size={30} color="var(--color-ember)" />
            </div>
          </div>
          <span className="meta-label-sm">lock · who can spend</span>
        </div>

        <div className="h-16 w-px bg-hairline" />

        <div className="flex flex-col items-center gap-3">
          <div className={A} style={anim('learn-stamp', 600, 600)}>
            <Stamp label="USDI · token" color="var(--color-flow-out)" />
          </div>
          <span className="meta-label-sm">type · the rules</span>
        </div>
      </div>
      <Caption delay={1200}>
        two guards run on-chain: the lock decides who may spend a cell; the type constrains what it can become
      </Caption>
    </div>
  )
}

/* ── 7 · Lifecycle ──────────────────────────────────────────────────────── */
function LifecycleScene() {
  const stations = ['Built', 'Sent', 'Pending', 'Proposed', 'Committed']
  const step = 2400 / stations.length
  return (
    <div className="flex w-full max-w-[600px] flex-col items-center gap-7">
      <div className="relative w-full px-2">
        <div className="absolute left-2 right-2 top-[7px] h-px bg-hairline" />
        {/* progress fill sweeping left→right */}
        <div
          className={`${A} absolute left-2 top-[7px] h-px`}
          style={anim('learn-fill', 300, 2400, {
            background: 'var(--color-ember)',
            animationTimingFunction: 'ease-in-out',
            animationFillMode: 'forwards',
            maxWidth: 'calc(100% - 16px)',
          })}
        />
        <div className="relative flex justify-between">
          {stations.map((s, k) => {
            const isLast = k === stations.length - 1
            const tint = isLast ? 'var(--color-flow-out)' : 'var(--color-ember)'
            return (
              <div key={s} className="flex flex-col items-center gap-2">
                <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-panel)' }}>
                  <span
                    className={A}
                    style={anim('learn-pop', 300 + k * step, 400, { background: tint, position: 'absolute', inset: '2px', animationFillMode: 'both' })}
                  />
                </span>
                <span
                  className={`${A} mono text-[9px] uppercase tracking-[0.1em]`}
                  style={anim('learn-rise', 300 + k * step, 400, { color: isLast ? 'var(--color-flow-out)' : 'var(--color-bone-dim)', animationFillMode: 'both' })}
                >
                  {s}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className={`${A} flex items-center gap-2`} style={anim('learn-rise', 2000)}>
        <span className="mono text-[11px]" style={{ color: 'var(--color-alarm)' }}>
          invalid ✕
        </span>
        <span className="mono text-[11px] text-muted">→ never recorded. CKB has no failed transactions.</span>
      </div>
      <Caption delay={2200}>
        a transaction is proposed, then committed into a block — or, if a script rejects it, simply never recorded
      </Caption>
    </div>
  )
}

/* ── 8 · Outro ──────────────────────────────────────────────────────────── */
function OutroScene() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <div className={A} style={anim('learn-pop', 0)}>
          <Cell owner="in" capacity="500" tone="input" locked />
        </div>
        <span className="mono text-[18px]" style={{ color: 'var(--color-ember)' }}>
          →
        </span>
        <div className={A} style={anim('learn-pop', 250)}>
          <Cell owner="out" capacity="499.99" tone="output" locked />
        </div>
      </div>
      <Caption delay={600}>now you can read any real CKB transaction as exactly this — cells in, cells out</Caption>
    </div>
  )
}

export interface Chapter {
  id: string
  kicker: string
  title: string
  body: string
  Scene: () => ReactNode
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    kicker: 'The idea',
    title: 'Value lives in boxes, not balances',
    body: "On CKB there are no accounts. Your money sits in little boxes called cells — each holds an amount and a lock, so only its owner can open it. Everything on CKB is a cell.",
    Scene: IntroScene,
  },
  {
    id: 'utxo',
    kicker: 'Where it comes from',
    title: 'The UTXO idea',
    body: 'CKB builds on Bitcoin\'s model. You never edit a balance — you spend whole "coins" and create new ones, sending the rest back to yourself as change. CKB makes those coins programmable.',
    Scene: UtxoScene,
  },
  {
    id: 'cell',
    kicker: 'The building block',
    title: 'A cell: the box itself',
    body: 'Every cell has four parts: its capacity (the CKB it holds, which also bounds how many bytes it can store), a lock (who can spend it), an optional type (rules, like a token standard), and data.',
    Scene: CellScene,
  },
  {
    id: 'balance',
    kicker: 'Your money',
    title: 'Your balance is many cells',
    body: 'There is no single account with a number in it. What you "have" is simply the sum of every cell locked to you — often many boxes, not one.',
    Scene: BalanceScene,
  },
  {
    id: 'transaction',
    kicker: 'Making a payment',
    title: 'A transaction: consume, then create',
    body: 'To pay someone you select input cells, consume them, and create new output cells — one for the recipient, one for your change. The old cells are gone; capacity is conserved except for a tiny fee.',
    Scene: TransactionScene,
  },
  {
    id: 'scripts',
    kicker: 'The rules',
    title: 'Two guards: the lock and the type',
    body: "Cells are guarded by small programs that run on-chain. The lock script decides who may spend a cell — the wrong key is rejected. The type script constrains what a cell can become, and is how tokens and state work.",
    Scene: ScriptsScene,
  },
  {
    id: 'lifecycle',
    kicker: 'Its life',
    title: "A transaction's lifecycle",
    body: 'Once built and sent, a transaction waits in the pool (pending, then proposed) before it is committed into a block. If any lock or type script rejects it, it is never recorded — CKB has no on-chain failed transactions.',
    Scene: LifecycleScene,
  },
  {
    id: 'outro',
    kicker: 'You know it now',
    title: 'Cells in, cells out',
    body: 'That is the whole model. Every real transaction is just cells being consumed and created, guarded by scripts. Open one and read it for yourself.',
    Scene: OutroScene,
  },
]
