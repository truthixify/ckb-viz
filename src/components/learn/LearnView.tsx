import { useEffect, useMemo, useState } from 'react'
import { clsx } from '@/app/clsx'
import '@/styles/learn.css'
import { Avatar, CkbCoin, PiggyBank, Padlock, Stamp } from './kit'

/**
 * The /learn walkthrough: an interactive, editable tour of the cell model, with
 * a sidebar of steps you pick from, Alice & Bob as the players, piggy banks for
 * cells, and controls you can change (balance, amount, stored data) — the
 * numbers, the holdings and the flow all update live. Ends at the real visualizer.
 */

const FEE = 0.001
const ALICE = 'var(--color-ember)'
const BOB = 'var(--color-flow-out)'

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 3, minimumFractionDigits: 0 })

interface Ctx {
  balance: number
  setBalance: (n: number) => void
  amount: number
  setAmount: (n: number) => void
}

interface Step {
  id: string
  label: string
  kicker: string
  title: string
  body: string
  render: (ctx: Ctx) => React.ReactNode
}

export function LearnView({ onExplore }: { onExplore: () => void }) {
  const [i, setI] = useState(0)
  const [balance, setBalance] = useState(500)
  const [amount, setAmount] = useState(120)

  const steps = useMemo(() => STEPS, [])
  const step = steps[i]!
  const last = steps.length - 1
  const ctx: Ctx = { balance, setBalance, amount, setAmount }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight') setI((c) => Math.min(last, c + 1))
      if (e.key === 'ArrowLeft') setI((c) => Math.max(0, c - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  return (
    <div className="flex flex-col gap-6 min-[820px]:flex-row min-[820px]:gap-10">
      {/* sidebar — pick a step */}
      <nav className="flex shrink-0 gap-2 overflow-x-auto min-[820px]:w-52 min-[820px]:flex-col min-[820px]:gap-1 min-[820px]:overflow-visible">
        {steps.map((s, k) => {
          const active = k === i
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setI(k)}
              className={clsx(
                'flex shrink-0 items-center gap-3 border px-3 py-2.5 text-left transition-colors min-[820px]:border-0 min-[820px]:border-l-2 min-[820px]:px-4',
                active
                  ? 'border-ember text-bone min-[820px]:bg-panel'
                  : 'border-hairline text-muted hover:text-bone-dim min-[820px]:border-l-hairline',
              )}
              style={active ? { borderLeftColor: 'var(--color-ember)' } : undefined}
            >
              <span className="mono text-[10px]" style={{ color: active ? 'var(--color-ember)' : 'var(--color-muted)' }}>
                {String(k + 1).padStart(2, '0')}
              </span>
              <span className="mono whitespace-nowrap text-[11px] uppercase tracking-[0.08em]">{s.label}</span>
            </button>
          )
        })}
      </nav>

      {/* main — the current step */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex min-h-[340px] items-center justify-center overflow-hidden border border-hairline bg-panel px-4 py-8 min-[560px]:px-8">
          <div key={step.id} className="w-full">
            {step.render(ctx)}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="meta-label" style={{ color: 'var(--color-ember)' }}>
            {step.kicker}
          </span>
          <h2 className="text-[24px] font-medium leading-tight tracking-tight text-bone min-[560px]:text-[28px]">
            {step.title}
          </h2>
          <p className="max-w-2xl text-[14px] leading-relaxed text-bone-dim">{step.body}</p>
        </div>

        <div className="mt-1 flex items-center justify-between gap-4 border-t border-hairline pt-5">
          <button
            type="button"
            onClick={() => setI((c) => Math.max(0, c - 1))}
            disabled={i === 0}
            className="mono border border-border px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:border-bone-dim hover:text-bone disabled:opacity-30"
          >
            ← Back
          </button>
          {i < last ? (
            <button
              type="button"
              onClick={() => setI((c) => Math.min(last, c + 1))}
              className="mono border border-border bg-panel px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:border-ember hover:text-ember"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={onExplore}
              className="mono border px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors"
              style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
            >
              Explore real transactions →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── controls ───────────────────────────────────────────────────────────── */

function Stepper({ label, value, onChange, min, max, step = 10, suffix = 'CKB' }: {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)))
  return (
    <div className="flex flex-col gap-1.5">
      <span className="meta-label-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="mono h-8 w-8 border border-border text-bone-dim transition-colors hover:border-ember hover:text-ember">
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="mono h-8 w-24 border border-border bg-inset px-2 text-center text-[13px] text-bone focus:border-ember focus:outline-none"
        />
        <button type="button" onClick={() => onChange(clamp(value + step))} className="mono h-8 w-8 border border-border text-bone-dim transition-colors hover:border-ember hover:text-ember">
          +
        </button>
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">{suffix}</span>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, max, tint = 'var(--color-ember)', unit = 'CKB' }: { label: string; value: number; onChange: (n: number) => void; max: number; tint?: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="meta-label-sm">{label}</span>
        <span className="mono text-[13px]" style={{ color: tint }}>{fmt(value)} {unit}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(max))}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="learn-range h-1 w-full"
        aria-label={label}
      />
    </div>
  )
}

/* ── reusable bits ──────────────────────────────────────────────────────── */

function PiggyLabel({ owner, capacity, sub, color, broken, locked, type, size = 92 }: {
  owner?: string
  capacity?: number | string
  sub?: string
  color: string
  broken?: boolean
  locked?: boolean
  type?: string
  size?: number
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ opacity: broken ? 0.4 : 1, transition: 'opacity 300ms var(--ease-instrument)' }}>
        <PiggyBank size={size} color={color} broken={broken ?? false} />
        {locked && (
          <span className="absolute -bottom-1 -right-1">
            <Padlock size={size * 0.26} color={color} />
          </span>
        )}
        {type && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Stamp label={type} color={color} />
          </span>
        )}
      </div>
      {owner && <span className="meta-label-sm">{owner}</span>}
      {capacity !== undefined && (
        <span className="mono text-[15px] font-medium text-bone">
          {typeof capacity === 'number' ? fmt(capacity) : capacity}{' '}
          <span className="text-[9px] uppercase tracking-[0.1em] text-muted">CKB</span>
        </span>
      )}
      {sub && <span className="mono text-[9px] uppercase tracking-[0.12em] text-muted">{sub}</span>}
    </div>
  )
}

/** A lane of coins continuously flowing between two points. */
function CoinFlow({ active = true, reverse = false, count = 3 }: { active?: boolean; reverse?: boolean; count?: number }) {
  if (!active) return <div className="h-px w-full min-w-16" style={{ background: 'var(--color-hairline)' }} />
  return (
    <div className="relative h-6 w-full min-w-16">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2" style={{ background: 'var(--color-hairline)' }} />
      {Array.from({ length: count }).map((_, k) => (
        <span
          key={k}
          aria-hidden
          className="absolute top-1/2"
          style={{
            marginTop: -6,
            animationName: 'learn-coin-lane',
            animationDuration: '1.8s',
            animationDelay: `${k * 0.6}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        >
          <CkbCoin size={12} style={{ display: 'block' }} />
        </span>
      ))}
    </div>
  )
}

/* ── steps ──────────────────────────────────────────────────────────────── */

const STEPS: Step[] = [
  {
    id: 'players',
    label: 'The players',
    kicker: 'Meet the players',
    title: 'Alice wants to pay Bob',
    body: 'Two people, one payment. Alice holds some CKB and wants to send Bob part of it. Set how much Alice has — you can change it any time, and the rest of the tour updates.',
    render: ({ balance, setBalance }) => (
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <Avatar name="Alice" color={ALICE} size={72} />
            <span className="mono text-[13px] text-bone">{fmt(balance)} CKB</span>
          </div>
          <span className="mono text-[22px]" style={{ color: 'var(--color-ember)' }}>→</span>
          <Avatar name="Bob" color={BOB} size={72} />
        </div>
        <Stepper label="Alice's balance" value={balance} onChange={setBalance} min={100} max={100000} step={50} />
      </div>
    ),
  },
  {
    id: 'utxo',
    label: 'Why cells',
    kicker: 'Two ways to hold money',
    title: 'No accounts — only cells',
    body: 'A bank keeps one balance and edits it when you pay. CKB has no balance anywhere: your money is a set of cells (this is the UTXO idea). To pay, you destroy some cells and create new ones. Press pay and watch both models react.',
    render: (ctx) => <AccountsVsCells ctx={ctx} />,
  },
  {
    id: 'cells',
    label: 'Cells hold it',
    kicker: 'Where the money lives',
    title: 'Value lives in piggy banks — cells',
    body: "Alice's balance isn't one number — it's held across little locked piggy banks called cells. Each is one UTXO: coins go in, and only Alice's key opens it.",
    render: ({ balance }) => {
      const piggies = splitBalance(balance)
      return (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-end justify-center gap-5">
            {piggies.map((c, k) => (
              <PiggyLabel key={k} owner="Alice's cell" capacity={c} color={ALICE} locked size={84} />
            ))}
          </div>
          <span className="mono text-[11px] text-muted">
            {piggies.length} cell{piggies.length === 1 ? '' : 's'} · {fmt(balance)} CKB total
          </span>
        </div>
      )
    },
  },
  {
    id: 'guards',
    label: 'Lock & type',
    kicker: 'The rules',
    title: 'Every cell has two guards',
    body: "A cell is guarded by small programs. The lock says who may spend it — only the owner's key opens the piggy bank. The type says what it may become — the rules behind tokens like RUSD.",
    render: () => (
      <div className="flex items-end justify-center gap-10">
        <PiggyLabel owner="lock · who can spend" capacity="100" color={ALICE} locked size={92} />
        <PiggyLabel owner="type · the rules" capacity="50" color={BOB} type="RUSD" size={92} />
      </div>
    ),
  },
  {
    id: 'capacity',
    label: 'Capacity',
    kicker: "CKB's twist",
    title: 'Capacity is space you reserve',
    body: 'On CKB, holding value means occupying room. A cell must reserve capacity for everything inside it — one byte costs one CKB — and the smallest possible cell is 61 CKB. Store more data, reserve more capacity. Slide to see it grow.',
    render: () => <CapacityScene />,
  },
  {
    id: 'send',
    label: 'Send money',
    kicker: 'Making the payment',
    title: 'Consume cells, create new ones',
    body: 'To pay Bob, Alice breaks open her cells and packs the coins into new ones — one for Bob, one of change back to herself. The old cells are gone; the new cells are what each person now holds. Drag the amount and watch the holdings settle live.',
    render: (ctx) => <SendScene ctx={ctx} />,
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    kicker: 'From sent to settled',
    title: "A transaction's journey",
    body: 'Once Alice signs and broadcasts, the transaction travels: it waits in the mempool, gets proposed in a block, then committed for good. A node checks every lock and type along the way — flip to an invalid transaction to see what happens when a guard says no.',
    render: () => <LifecycleScene />,
  },
  {
    id: 'recap',
    label: 'Recap',
    kicker: "You've got it",
    title: 'Cells in, cells out',
    body: 'That is the whole model: value in locked cells, spent by consuming them and creating new ones, guarded by scripts, each reserving its own capacity. Now open a real transaction and read it for yourself.',
    render: ({ balance, amount }) => {
      const send = Math.min(amount, Math.max(0, balance - FEE))
      return (
        <div className="flex flex-wrap items-center justify-center gap-6">
          <PiggyLabel owner="Alice" capacity={balance} color={ALICE} broken size={80} locked />
          <span className="mono text-[20px]" style={{ color: 'var(--color-ember)' }}>→</span>
          <PiggyLabel owner="→ Bob" capacity={send} color={BOB} size={80} locked />
          <PiggyLabel owner="change" capacity={Math.max(0, balance - send - FEE)} color={ALICE} size={80} locked />
        </div>
      )
    },
  },
]

/* ── accounts vs cells (UTXO) ───────────────────────────────────────────── */

function AccountsVsCells({ ctx }: { ctx: Ctx }) {
  const [paid, setPaid] = useState(false)
  const { balance, amount } = ctx
  const send = Math.min(amount, Math.max(0, balance - FEE))
  const change = Math.max(0, balance - send - FEE)

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full grid-cols-1 items-stretch gap-4 min-[620px]:grid-cols-[1fr_auto_1fr]">
        {/* account model */}
        <div className="flex flex-col items-center gap-3 border border-hairline bg-inset px-4 py-5">
          <span className="meta-label-sm" style={{ color: 'var(--color-bone-dim)' }}>Account model · a bank</span>
          <span key={paid ? 'a1' : 'a0'} className="learn-anim mono text-[30px] font-medium tracking-tight text-bone" style={{ animationName: 'learn-pop' }}>
            {fmt(paid ? change + 0 : balance)} <span className="text-[11px] uppercase tracking-[0.1em] text-muted">CKB</span>
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: paid ? 'var(--color-alarm)' : 'var(--color-muted)' }}>
            {paid ? `− ${fmt(send)} paid to Bob` : "Alice's balance"}
          </span>
          <span className="mt-1 text-center text-[11px] leading-relaxed text-muted">One running number. Paying edits it in place.</span>
        </div>

        <div className="flex items-center justify-center">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">vs</span>
        </div>

        {/* cell model */}
        <div className="flex flex-col items-center gap-3 border px-4 py-5" style={{ borderColor: 'color-mix(in oklab, var(--color-ember) 30%, transparent)', background: 'color-mix(in oklab, var(--color-ember) 5%, transparent)' }}>
          <span className="meta-label-sm" style={{ color: 'var(--color-ember)' }}>Cell model · CKB</span>
          <div className="flex min-h-[92px] flex-wrap items-center justify-center gap-3">
            {!paid ? (
              <PiggyLabel capacity={balance} color={ALICE} locked size={64} sub="Alice · 1 cell" />
            ) : (
              <>
                <PiggyLabel capacity={balance} color={ALICE} broken size={52} sub="destroyed" />
                <span className="mono text-[16px]" style={{ color: 'var(--color-ember)' }}>→</span>
                <PiggyLabel capacity={send} color={BOB} locked size={52} sub="Bob" />
                <PiggyLabel capacity={change} color={ALICE} locked size={52} sub="Alice" />
              </>
            )}
          </div>
          <span className="text-center text-[11px] leading-relaxed text-muted">No balance. Old cell destroyed; new cells created.</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPaid((p) => !p)}
        className="mono border px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors"
        style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
      >
        {paid ? '↺ Reset' : `▶ Pay Bob ${fmt(send)} CKB`}
      </button>
    </div>
  )
}

/* ── capacity is space ──────────────────────────────────────────────────── */

const BASE_CAPACITY = 61

function dataMeaning(bytes: number): string {
  if (bytes === 0) return 'an empty cell — just capacity, no data'
  if (bytes <= 16) return 'a token balance (a 16-byte number, e.g. RUSD)'
  if (bytes <= 120) return 'a name, a note, or a small record'
  return 'an on-chain NFT, an image, or a script'
}

function CapacityScene() {
  const [bytes, setBytes] = useState(16)
  const total = BASE_CAPACITY + bytes
  const barMax = BASE_CAPACITY + 400
  const basePct = (BASE_CAPACITY / barMax) * 100
  const dataPct = (bytes / barMax) * 100

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="flex items-baseline gap-2">
        <span className="mono text-[40px] font-medium leading-none tracking-tight text-bone">{fmt(total)}</span>
        <span className="mono text-[12px] uppercase tracking-[0.1em] text-muted">CKB reserved</span>
      </div>

      <div className="w-full">
        <div className="flex h-6 w-full overflow-hidden border border-hairline bg-inset">
          <div className="h-full" style={{ width: `${basePct}%`, background: 'color-mix(in oklab, var(--color-ember) 55%, transparent)' }} />
          <div className="h-full transition-[width] duration-200 ease-out" style={{ width: `${dataPct}%`, background: 'var(--color-flow-out)' }} />
        </div>
        <div className="mt-2 flex justify-between">
          <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-ember)' }}>■ base 61 CKB</span>
          <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-flow-out)' }}>■ data {bytes} CKB</span>
        </div>
      </div>

      <div className="w-full">
        <Slider label="Data stored (bytes)" value={bytes} onChange={setBytes} max={400} tint="var(--color-flow-out)" unit="bytes" />
      </div>

      <span className="mono text-center text-[11px] text-bone-dim">
        {fmt(total)} CKB holds {dataMeaning(bytes)}.
      </span>
    </div>
  )
}

/* ── the payment: flow + who holds what ─────────────────────────────────── */

function SendScene({ ctx }: { ctx: Ctx }) {
  const { balance, amount, setAmount, setBalance } = ctx
  const inputs = splitBalance(balance)
  const maxSend = Math.max(0, balance - FEE)
  const send = Math.min(amount, maxSend)
  const change = Math.max(0, balance - send - FEE)

  return (
    <div className="flex w-full flex-col gap-5">
      {/* the transaction: Alice's input cells → tx → new cells */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 min-[560px]:gap-4">
        <div className="flex flex-col items-center gap-2">
          <Avatar name="Alice" color={ALICE} size={48} />
          <div className="flex flex-col items-center gap-1">
            {inputs.map((c, k) => (
              <PiggyLabel key={k} capacity={c} color={ALICE} broken size={44} />
            ))}
          </div>
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">spends {inputs.length} cell{inputs.length === 1 ? '' : 's'}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <CoinFlow active={send > 0} />
          <span className="mono border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-ember)', borderColor: 'var(--color-ember)' }}>
            transaction
          </span>
          <span className="mono text-[10px] text-muted">fee {FEE}</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <Avatar name="Bob" color={BOB} size={40} />
            <PiggyLabel capacity={send} color={BOB} locked size={48} sub="new cell" />
          </div>
          <PiggyLabel owner="↩ Alice's change" capacity={change} color={ALICE} locked size={48} sub="new cell" />
        </div>
      </div>

      {/* holdings ledger: sent + who holds what now */}
      <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-4">
        <Stat label="Sent to Bob" value={send} tint="var(--color-flow-out)" />
        <Stat label="Alice holds now" value={change} sub="1 cell" tint={ALICE} />
        <Stat label="Bob holds now" value={send} sub="1 cell" tint="var(--color-flow-out)" />
      </div>

      {/* controls */}
      <div className="flex flex-col gap-4 border-t border-hairline pt-4 min-[560px]:flex-row min-[560px]:items-end min-[560px]:gap-8">
        <div className="min-[560px]:flex-1">
          <Slider label="Alice sends Bob" value={send} onChange={setAmount} max={maxSend} />
        </div>
        <Stepper label="Alice's balance" value={balance} onChange={setBalance} min={100} max={100000} step={50} />
      </div>
    </div>
  )
}

function Stat({ label, value, sub, tint }: { label: string; value: number; sub?: string; tint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="meta-label-sm">{label}</span>
      <span className="mono text-[18px] font-medium tracking-tight" style={{ color: tint }}>
        {fmt(value)} <span className="text-[9px] uppercase tracking-[0.1em] text-muted">CKB</span>
      </span>
      {sub && <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">{sub}</span>}
    </div>
  )
}

/* ── lifecycle journey ──────────────────────────────────────────────────── */

const STATIONS = [
  { label: 'Built', sub: 'assemble & sign' },
  { label: 'Sent', sub: 'broadcast' },
  { label: 'Pending', sub: 'in the mempool' },
  { label: 'Proposed', sub: 'in a block' },
  { label: 'Committed', sub: 'sealed' },
]

function LifecycleScene() {
  const [mode, setMode] = useState<'valid' | 'invalid'>('valid')
  const invalid = mode === 'invalid'
  const gate = 2 // Pending — where a node validates and can reject
  const reached = (k: number) => (invalid ? k <= gate : true)
  const fillWidth = invalid ? '50%' : '100%'
  const fillColor = invalid ? 'var(--color-alarm)' : 'var(--color-ember)'

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <div className="inline-flex border border-border">
        {(['valid', 'invalid'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="mono px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors"
            style={
              mode === m
                ? { background: m === 'invalid' ? 'color-mix(in oklab, var(--color-alarm) 18%, transparent)' : 'color-mix(in oklab, var(--color-ember) 18%, transparent)', color: m === 'invalid' ? 'var(--color-alarm)' : 'var(--color-ember)' }
                : { color: 'var(--color-muted)' }
            }
          >
            {m === 'valid' ? 'Valid tx' : 'Invalid tx'}
          </button>
        ))}
      </div>

      <div key={mode} className="relative w-full px-1">
        {/* base track */}
        <div className="absolute left-1 right-1 top-[9px] h-px bg-hairline" />
        {/* progress fill */}
        <div
          className="learn-anim absolute left-1 top-[9px] h-px origin-left"
          style={{ width: `calc(${fillWidth} - 8px)`, background: fillColor, animationName: 'learn-grow-x', animationDuration: '1.6s', animationTimingFunction: 'ease-in-out' }}
        />
        {/* travelling packet */}
        <div className="pointer-events-none absolute left-1 right-1 top-[9px]">
          <span
            className="absolute -top-[6px]"
            style={{ animationName: invalid ? 'learn-hop-reject' : 'learn-hop', animationDuration: invalid ? '4s' : '5.5s', animationIterationCount: 'infinite', animationTimingFunction: 'linear' }}
          >
            <CkbCoin size={12} style={{ display: 'block' }} />
          </span>
        </div>

        <div className="relative flex justify-between">
          {STATIONS.map((s, k) => {
            const on = reached(k)
            const isCommitted = k === STATIONS.length - 1 && !invalid
            const isGate = k === gate && invalid
            const tint = isCommitted ? 'var(--color-flow-out)' : isGate ? 'var(--color-alarm)' : on ? 'var(--color-ember)' : 'var(--color-muted)'
            return (
              <div key={s.label} className="flex flex-col items-center gap-2" style={{ maxWidth: 84 }}>
                <span className="relative inline-flex h-4 w-4 items-center justify-center border" style={{ borderColor: on ? tint : 'var(--color-border)', background: 'var(--color-panel)' }}>
                  <span
                    style={{
                      position: 'absolute',
                      inset: '2px',
                      background: on ? tint : 'transparent',
                      animationName: isCommitted || isGate ? 'learn-glow' : 'none',
                      animationDuration: '1.4s',
                      animationIterationCount: 'infinite',
                    }}
                  />
                </span>
                <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: on ? (isCommitted ? 'var(--color-flow-out)' : isGate ? 'var(--color-alarm)' : 'var(--color-bone-dim)') : 'var(--color-muted)' }}>
                  {s.label}
                </span>
                <span className="mono text-center text-[8px] uppercase tracking-[0.08em] text-muted">{isGate ? 'rejected ✕' : s.sub}</span>
              </div>
            )
          })}
        </div>
      </div>

      <span className="mono max-w-md text-center text-[11px] leading-relaxed text-muted">
        {invalid ? (
          <>
            A node runs the scripts. A guard says no, so the transaction is{' '}
            <span style={{ color: 'var(--color-alarm)' }}>dropped from the pool</span> — it never reaches a block. No failed transaction is ever recorded.
          </>
        ) : (
          <>
            Every lock and type passes, and the transaction is{' '}
            <span style={{ color: 'var(--color-flow-out)' }}>committed into a block</span> for good.
          </>
        )}
      </span>
    </div>
  )
}

/* ── helpers ────────────────────────────────────────────────────────────── */

function splitBalance(balance: number): number[] {
  // Illustrative: show the balance as a handful of cells (not one number).
  if (balance <= 150) return [balance]
  if (balance <= 400) return [Math.round(balance * 0.6), Math.round(balance * 0.4)]
  const a = Math.round(balance * 0.45)
  const b = Math.round(balance * 0.33)
  return [a, b, balance - a - b]
}
