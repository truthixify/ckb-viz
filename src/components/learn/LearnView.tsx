import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from '@/app/clsx'
import '@/styles/learn.css'
import { Avatar, CellCoin, PiggyBank, Padlock, Stamp, TxPacket, Wallet } from './kit'

/**
 * The /learn walkthrough: an interactive tour of CKB's cell model.
 *
 * Metaphor (see kit.tsx): a PIGGY BANK is a person's wallet — one per person,
 * it holds coins and persists. A COIN is one cell (one UTXO): value, lock, type.
 * Paying consumes coins and mints new ones; a new UTXO is a new coin dropped
 * into a wallet, never a new piggy bank. People are ember/bone avatars + A/B
 * lock badges; blue/green/red are role markers only (input/output/rejected).
 */

const FEE = 0.001
const ALICE = 'var(--color-ember)'
const BOB = 'var(--color-bone-dim)'

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 3, minimumFractionDigits: 0 })

/** Merge CSS custom properties into a style object without widening to `any`. */
const cssVars = (base: React.CSSProperties, vars: Record<`--${string}`, string | number>): React.CSSProperties =>
  ({ ...base, ...vars }) as React.CSSProperties

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduce
}

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

/* ── steps ──────────────────────────────────────────────────────────────── */

const STEPS: Step[] = [
  {
    id: 'players',
    label: 'The players',
    kicker: 'Meet the players',
    title: 'Alice wants to pay Bob',
    body: "Two people, two wallets. Alice's wallet holds some coins; Bob's is empty. She wants to send him part of what she has. Change Alice's balance and watch coins appear in her wallet — a balance is just coins.",
    render: ({ balance, setBalance }) => {
      const coins = splitBalance(balance)
      return (
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-8 min-[560px]:gap-12">
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Alice" color={ALICE} size={52} />
              <Wallet owner="" color={ALICE} coins={coins} size={128} />
            </div>
            <span className="mono text-[22px]" style={{ color: 'var(--color-ember)' }}>→</span>
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Bob" color={BOB} size={52} />
              <Wallet owner="" color={BOB} coins={[]} size={128} emptyLabel="empty" />
            </div>
          </div>
          <Stepper label="Alice's balance" value={balance} onChange={setBalance} min={100} max={100000} step={50} />
        </div>
      )
    },
  },
  {
    id: 'utxo',
    label: 'Why cells',
    kicker: 'Two ways to hold money',
    title: 'No accounts — only coins',
    body: 'A bank keeps one balance and edits it when you pay. CKB keeps no balance: your money is a set of coins (cells — the UTXO idea). To pay, specific coins are destroyed and new coins are minted. Same wallet, different coins. Press pay and watch both react.',
    render: (ctx) => <AccountsVsCells ctx={ctx} />,
  },
  {
    id: 'cells',
    label: 'Cells hold it',
    kicker: 'Where the money lives',
    title: 'A balance is a pile of coins',
    body: "Alice's wallet is one piggy bank, but her balance isn't one number — it's several coins inside it. Each coin is one cell, carrying its value and Alice's lock (the “A”). The wallet is just which coins carry Alice's key.",
    render: ({ balance }) => {
      const coins = splitBalance(balance)
      return (
        <div className="flex flex-col items-center gap-5">
          <Avatar name="Alice" color={ALICE} size={48} />
          <PiggyBank size={116} color={ALICE} />
          <div className="flex flex-col items-center gap-2">
            <span className="meta-label-sm">inside her wallet</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {coins.map((v, k) => (
                <CellCoin key={k} value={v} owner="A" size={50} />
              ))}
            </div>
          </div>
          <span className="mono text-[11px] text-muted">
            {coins.length} coin{coins.length === 1 ? '' : 's'} · {fmt(balance)} CKB · each coin is one cell
          </span>
        </div>
      )
    },
  },
  {
    id: 'guards',
    label: 'Lock & type',
    kicker: 'The rules',
    title: 'Every coin has two guards',
    body: "A coin is guarded by small programs. The lock says who may spend it — only the owner's key opens it. The type says what it is — the rules behind a token like RUSD. Two guards, one coin. The token lives in the coin's data; it still reserves CKB capacity.",
    render: () => (
      <div className="flex flex-col items-center gap-8">
        <CellCoin value={100} owner="A" type="RUSD" size={116} />
        <div className="flex flex-wrap justify-center gap-10">
          <div className="flex items-center gap-2">
            <Padlock size={22} color={ALICE} />
            <span className="mono text-[11px] text-bone-dim">lock · only Alice's key spends it</span>
          </div>
          <div className="flex items-center gap-2">
            <Stamp label="RUSD" />
            <span className="mono text-[11px] text-bone-dim">type · the token's rules</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'capacity',
    label: 'Capacity',
    kicker: "CKB's twist",
    title: "A coin's value is its room",
    body: "On CKB a coin's value and its byte-room are one thing: capacity. One byte costs one CKB, and the smallest coin is 61 CKB. Store more data and the coin gets bigger and costlier. Slide to grow it.",
    render: () => <CapacityScene />,
  },
  {
    id: 'send',
    label: 'Send money',
    kicker: 'Making the payment',
    title: 'Consume coins, mint new ones',
    body: "To pay Bob, Alice's coins are lifted out of her wallet and destroyed at the transaction; fresh coins are minted — one dropped into Bob's wallet, one of change back into Alice's. Her wallet never breaks. Drag the amount, then press Sign & send to watch the coins move.",
    render: (ctx) => <SendScene ctx={ctx} />,
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    kicker: 'From sent to settled',
    title: "A transaction's journey",
    body: 'Once Alice signs and broadcasts, the transaction travels: it waits in the mempool, a node checks every lock and type, then it is proposed and committed into a block. Flip to an invalid transaction to see a guard reject it — dropped from the pool, never recorded.',
    render: () => <LifecycleScene />,
  },
  {
    id: 'recap',
    label: 'Recap',
    kicker: "You've got it",
    title: 'Same wallets, new coins',
    body: "That's the whole model. The two wallets persisted; the coins inside changed. Alice's old coins are gone and she holds her change; Bob holds his new coin. Cells in, cells out. Now open a real transaction and read it yourself.",
    render: ({ balance, amount }) => {
      const send = Math.min(amount, Math.max(0, balance - FEE))
      const change = Math.max(0, balance - send - FEE)
      return (
        <div className="flex flex-wrap items-start justify-center gap-10 min-[560px]:gap-16">
          <div className="flex flex-col items-center gap-2">
            <Avatar name="Alice" color={ALICE} size={48} />
            <Wallet owner="holds now" color={ALICE} coins={change > 0 ? [change] : []} size={124} emptyLabel="empty" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar name="Bob" color={BOB} size={48} />
            <Wallet owner="holds now" color={BOB} coins={send > 0 ? [send] : []} size={124} emptyLabel="empty" />
          </div>
        </div>
      )
    },
  },
]

/* ── accounts vs cells (UTXO) ───────────────────────────────────────────── */

function AccountsVsCells({ ctx }: { ctx: Ctx }) {
  const [paid, setPaid] = useState(false)
  const { balance, amount } = ctx
  const inputs = splitBalance(balance)
  const send = Math.min(amount, Math.max(0, balance - FEE))
  const change = Math.max(0, balance - send - FEE)

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full grid-cols-1 items-stretch gap-4 min-[680px]:grid-cols-[1fr_auto_1.3fr]">
        <div className="flex flex-col items-center justify-center gap-3 border border-hairline bg-inset px-4 py-5">
          <span className="meta-label-sm" style={{ color: 'var(--color-bone-dim)' }}>Account model · a bank</span>
          <span key={paid ? 'a1' : 'a0'} className="learn-anim mono text-[30px] font-medium tracking-tight text-bone" style={{ animationName: 'learn-pop', animationDuration: '260ms' }}>
            {fmt(paid ? change : balance)} <span className="text-[11px] uppercase tracking-[0.1em] text-muted">CKB</span>
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.12em]" style={{ color: paid ? 'var(--color-alarm)' : 'var(--color-muted)' }}>
            {paid ? `− ${fmt(send)} paid to Bob` : "Alice's balance"}
          </span>
          <span className="mt-1 text-center text-[11px] leading-relaxed text-muted">One number, edited in place.</span>
        </div>

        <div className="flex items-center justify-center">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">vs</span>
        </div>

        <div className="flex flex-col items-center gap-3 border px-4 py-5" style={{ borderColor: 'color-mix(in oklab, var(--color-ember) 30%, transparent)', background: 'color-mix(in oklab, var(--color-ember) 5%, transparent)' }}>
          <span className="meta-label-sm" style={{ color: 'var(--color-ember)' }}>Cell model · CKB</span>
          <div className="flex min-h-[112px] items-center justify-center gap-3">
            {!paid ? (
              <Wallet owner="Alice" color={ALICE} coins={inputs} size={116} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="flex gap-0.5">
                    {inputs.map((v, k) => (
                      <CellCoin key={k} value={v} role="input" consumed size={26} showBadge={false} />
                    ))}
                  </span>
                  <span className="mono text-[8px] uppercase tracking-[0.1em] text-muted">destroyed</span>
                </div>
                <span className="mono text-[14px]" style={{ color: 'var(--color-ember)' }}>→</span>
                <Wallet owner="Bob" color={BOB} coins={send > 0 ? [send] : []} size={92} coinRole="output" emptyLabel="—" />
                <Wallet owner="Alice" color={ALICE} coins={change > 0 ? [change] : []} size={92} coinRole="output" emptyLabel="—" />
              </div>
            )}
          </div>
          <span className="text-center text-[11px] leading-relaxed text-muted">Coins destroyed; new coins minted.</span>
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

/* ── capacity ───────────────────────────────────────────────────────────── */

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
  const coinSize = Math.round(58 + (bytes / 400) * 78)

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="flex items-center gap-5">
        <CellCoin value={total} size={coinSize} style={{ transition: 'width 200ms ease-out, height 200ms ease-out' }} />
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

/* ── the payment: coins moving between wallets ──────────────────────────── */

const ALICE_X = '17%'
const FORGE_X = '50%'
const BOB_X = '83%'
const FLY_TOP = '60%'
const FLY_COIN = 34
const STAG = 90
const ARRIVE = 640

function SendScene({ ctx }: { ctx: Ctx }) {
  const { balance, amount, setAmount, setBalance } = ctx
  const reduce = usePrefersReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [flight, setFlight] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  const inputs = splitBalance(balance)
  const nIn = inputs.length
  const maxSend = Math.max(0, balance - FEE)
  const send = Math.min(amount, maxSend)
  const change = Math.max(0, balance - send - FEE)

  const deliverStart = nIn * STAG + ARRIVE + 60
  const playMs = deliverStart + ARRIVE + 260

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const play = () => {
    if (reduce || send <= 0) return
    setFlight((f) => f + 1)
    setPlaying(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPlaying(false), playMs)
  }

  const aliceCoins = playing ? [] : change > 0 ? [change] : []
  const bobCoins = playing ? [] : send > 0 ? [send] : []

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="relative" style={{ minHeight: 172 }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Alice" color={ALICE} size={44} />
            <Wallet owner="" color={ALICE} coins={aliceCoins} size={104} emptyLabel="" receiveKey={playing ? 0 : flight} />
          </div>

          <div className="flex flex-col items-center gap-2 px-2">
            <span
              className="mono grid place-items-center border px-3 py-2 text-[9px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--color-ember)', borderColor: 'var(--color-ember)', minWidth: 92 }}
            >
              transaction
            </span>
            <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">fee {FEE} → miner</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Bob" color={BOB} size={44} />
            <Wallet owner="" color={BOB} coins={bobCoins} size={104} emptyLabel="empty" receiveKey={playing ? 0 : flight} />
          </div>
        </div>

        {playing && !reduce && (
          <div key={flight} className="pointer-events-none absolute inset-0">
            {inputs.map((v, k) => (
              <span
                key={`in-${k}`}
                className="learn-fly-outer"
                style={cssVars(
                  {
                    position: 'absolute',
                    top: FLY_TOP,
                    marginLeft: -FLY_COIN / 2,
                    marginTop: -FLY_COIN / 2,
                    animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${k * STAG}ms both, forge-melt 260ms var(--ease-instrument) ${k * STAG + ARRIVE}ms both`,
                  },
                  { '--l0': ALICE_X, '--l1': FORGE_X },
                )}
              >
                <span className="learn-fly-inner" style={{ display: 'block', animation: `send-fly-y ${ARRIVE}ms cubic-bezier(.34,0,.5,1) ${k * STAG}ms both` }}>
                  <CellCoin value={v} role="input" size={FLY_COIN} showBadge={false} />
                </span>
              </span>
            ))}

            {send > 0 && (
              <span
                key="out-bob"
                className="learn-fly-outer"
                style={cssVars(
                  {
                    position: 'absolute',
                    top: FLY_TOP,
                    marginLeft: -FLY_COIN / 2,
                    marginTop: -FLY_COIN / 2,
                    animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${deliverStart}ms both`,
                  },
                  { '--l0': FORGE_X, '--l1': BOB_X },
                )}
              >
                <span className="learn-fly-inner" style={{ display: 'block', animation: `send-fly-y ${ARRIVE}ms cubic-bezier(.34,0,.5,1) ${deliverStart}ms both` }}>
                  <CellCoin value={send} owner="B" role="output" size={FLY_COIN} />
                </span>
              </span>
            )}

            {change > 0 && (
              <span
                key="out-change"
                className="learn-fly-outer"
                style={cssVars(
                  {
                    position: 'absolute',
                    top: FLY_TOP,
                    marginLeft: -FLY_COIN / 2,
                    marginTop: -FLY_COIN / 2,
                    animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${deliverStart}ms both`,
                  },
                  { '--l0': FORGE_X, '--l1': ALICE_X },
                )}
              >
                <span className="learn-fly-inner" style={{ display: 'block', animation: `send-fly-y ${ARRIVE}ms cubic-bezier(.34,0,.5,1) ${deliverStart}ms both` }}>
                  <CellCoin value={change} owner="A" role="output" size={FLY_COIN} />
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-4">
        <Stat label="Sent to Bob" value={send} tint="var(--color-flow-out)" />
        <Stat label="Alice holds now" value={change} sub={change > 0 ? '1 coin' : 'no coins'} tint={ALICE} />
        <Stat label="Bob holds now" value={send} sub={send > 0 ? '1 coin' : 'no coins'} tint="var(--color-flow-out)" />
      </div>

      <div className="flex flex-col gap-4 border-t border-hairline pt-4 min-[620px]:flex-row min-[620px]:items-end min-[620px]:gap-6">
        <div className="min-[620px]:flex-1">
          <Slider label="Alice sends Bob" value={send} onChange={setAmount} max={maxSend} />
        </div>
        <Stepper label="Alice's balance" value={balance} onChange={setBalance} min={100} max={100000} step={50} />
        <button
          type="button"
          onClick={play}
          disabled={playing || send <= 0}
          className="mono h-9 shrink-0 border px-4 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
        >
          {playing ? 'Sending…' : '▶ Sign & send'}
        </button>
      </div>
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
const GATE = 2

function LifecycleScene() {
  const reduce = usePrefersReducedMotion()
  const [mode, setMode] = useState<'valid' | 'invalid'>('valid')
  const [stage, setStage] = useState(0)
  const [rejected, setRejected] = useState(false)
  const invalid = mode === 'invalid'

  useEffect(() => {
    setStage(0)
    setRejected(false)
    if (reduce) {
      if (invalid) {
        setStage(GATE)
        setRejected(true)
      } else {
        setStage(STATIONS.length - 1)
      }
      return
    }
    const timers: number[] = []
    const at = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
    if (invalid) {
      at(() => setStage(1), 450)
      at(() => setStage(GATE), 1150)
      at(() => setRejected(true), 1650)
    } else {
      at(() => setStage(1), 450)
      at(() => setStage(2), 1150)
      at(() => setStage(3), 1900)
      at(() => setStage(4), 2550)
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [mode, reduce, invalid])

  const committed = !invalid && stage >= STATIONS.length - 1
  const packetStage = invalid ? Math.min(stage, GATE) : stage
  const fillPct = invalid ? Math.min(stage, GATE) * 25 : stage * 25

  return (
    <div className="flex w-full flex-col items-center gap-8">
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

      <div className="relative w-full px-1 pt-8">
        <div className="absolute left-1 right-1 top-[calc(2rem+9px)] h-px bg-hairline" />
        <div
          className="absolute left-1 top-[calc(2rem+9px)] h-px"
          style={{ width: `${fillPct}%`, maxWidth: 'calc(100% - 8px)', background: invalid ? 'var(--color-alarm)' : 'var(--color-ember)', transition: 'width 560ms cubic-bezier(.5,0,.2,1)' }}
        />

        <span
          className="learn-packet absolute"
          style={{
            top: 0,
            left: `${packetStage * 25}%`,
            marginLeft: -20,
            transition: 'left 560ms cubic-bezier(.5,0,.2,1)',
            animation: rejected ? 'packet-reject 900ms cubic-bezier(.5,.05,.9,.5) both' : committed ? 'commit-seal 520ms cubic-bezier(.3,1.4,.5,1) both' : undefined,
          }}
        >
          <TxPacket size={40} validated={!invalid && stage >= GATE} rejected={rejected} />
        </span>

        <div className="relative flex justify-between">
          {STATIONS.map((s, k) => {
            const on = invalid ? k <= GATE : stage >= k
            const isCommitted = k === STATIONS.length - 1 && committed
            const isGate = k === GATE && rejected
            const tint = isCommitted ? 'var(--color-flow-out)' : isGate ? 'var(--color-alarm)' : on ? 'var(--color-ember)' : 'var(--color-muted)'
            return (
              <div key={s.label} className="flex flex-col items-center gap-2" style={{ maxWidth: 88 }}>
                <span className="inline-flex h-4 w-4 items-center justify-center border" style={{ borderColor: on ? tint : 'var(--color-border)', background: 'var(--color-panel)' }}>
                  <span style={{ position: 'absolute', width: 8, height: 8, background: on ? tint : 'transparent', transition: 'background 220ms ease' }} />
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
  if (balance <= 150) return [balance]
  if (balance <= 400) return [Math.round(balance * 0.6), Math.round(balance * 0.4)]
  const a = Math.round(balance * 0.45)
  const b = Math.round(balance * 0.33)
  return [a, b, balance - a - b]
}
