import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from '@/app/clsx'
import '@/styles/learn.css'
import { Avatar, BankBuilding, CellCoin, PiggyBank, Padlock, Stamp, TxPacket, Wallet } from './kit'

/**
 * The /learn walkthrough: an interactive tour of CKB's cell model.
 *
 * Metaphor (see kit.tsx): a PIGGY BANK is a person's wallet - one per person,
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
  /** The send screen's own running wallets. They accumulate across payments and
   *  are not shared with the illustrative steps (players, cells, recap). */
  payAlice: number[]
  payBob: number[]
  pay: (amount: number) => void
  resetPay: () => void
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

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
  const [balance, setBalanceRaw] = useState(500)
  const [amount, setAmount] = useState(120)
  const [payAlice, setPayAlice] = useState<number[]>(() => splitBalance(500))
  const [payBob, setPayBob] = useState<number[]>([])

  const setBalance = (n: number) => {
    setBalanceRaw(n)
    setPayAlice(splitBalance(n))
    setPayBob([])
    setAmount((a) => Math.min(a, Math.max(0, n - FEE)))
  }
  const pay = (amt: number) => {
    const total = payAlice.reduce((a, b) => a + b, 0)
    const sendAmt = Math.min(amt, Math.max(0, total - FEE))
    if (sendAmt <= 0) return
    const change = round3(total - sendAmt - FEE)
    setPayAlice(change > 0 ? [change] : [])
    setPayBob((prev) => [...prev, sendAmt])
  }
  const resetPay = () => {
    setPayAlice(splitBalance(balance))
    setPayBob([])
  }

  const steps = useMemo(() => STEPS, [])
  const step = steps[i]!
  const last = steps.length - 1
  const ctx: Ctx = { balance, setBalance, amount, setAmount, payAlice, payBob, pay, resetPay }

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
              aria-current={active ? 'step' : undefined}
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
        <div className="relative flex min-h-[340px] items-center justify-center overflow-visible border border-hairline bg-panel px-4 py-8 min-[560px]:px-8">
          <div key={step.id} className="w-full">
            {step.render(ctx)}
          </div>
        </div>

        <div className="flex flex-col gap-3" aria-live="polite">
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
    id: 'utxo',
    label: 'Bank vs piggy',
    kicker: 'The big idea',
    title: 'A bank account, or a piggy bank?',
    body: 'Most money apps work like a bank account: the bank keeps one number, your balance, and rewrites it when you pay. CKB is different. Your money is not a number at all. It is a set of separate coins you own, the way a piggy bank holds coins, and each coin is called a cell. This is the UTXO model. Press Pay to see how each side handles the same payment, then the next steps show what a coin really is.',
    render: (ctx) => <AccountsVsCells ctx={ctx} />,
  },
  {
    id: 'players',
    label: 'The players',
    kicker: 'The people',
    title: 'Alice is going to pay Bob',
    body: "Meet Alice and Bob. Each person keeps their coins in their own piggy bank, which we will call a wallet. Right now Alice holds some coins and Bob holds none. Over the next steps Alice will send Bob part of what she has. Use the control to change how much Alice starts with, and notice that her balance is simply the coins in her wallet added together. Hover over any coin to see what it holds.",
    render: ({ balance, setBalance }) => {
      const coins = splitBalance(balance)
      return (
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-8 min-[560px]:gap-12">
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Alice" color={ALICE} size={52} />
              <Wallet owner="" ownerLetter="A" color={ALICE} coins={coins} size={128} />
            </div>
            <span className="mono text-[22px]" style={{ color: 'var(--color-ember)' }}>→</span>
            <div className="flex flex-col items-center gap-2">
              <Avatar name="Bob" color={BOB} size={52} />
              <Wallet owner="" ownerLetter="B" color={BOB} coins={[]} size={128} emptyLabel="empty" />
            </div>
          </div>
          <Stepper label="Alice's balance" value={balance} onChange={setBalance} min={100} max={100000} step={50} />
        </div>
      )
    },
  },
  {
    id: 'cells',
    label: 'What a balance is',
    kicker: 'Inside the wallet',
    title: 'A balance is a stack of coins',
    body: "Alice has one wallet, but her balance is not stored as a single number anywhere. It is made of several separate coins inside the wallet, and each coin is one cell. A cell records how much it is worth and whose key can spend it, shown here as the letter A for Alice. Add the coins up and you get her balance. Hover over a coin to inspect it.",
    render: ({ balance }) => <CellsScene balance={balance} />,
  },
  {
    id: 'guards',
    label: 'A coin’s rules',
    kicker: 'What guards a coin',
    title: 'Every coin carries its own rules',
    body: "A cell is more than an amount. It carries two small programs. The first is the lock, which decides who is allowed to spend the coin: only the person holding the matching key. The second is the type, which decides what the coin is. For a token like RUSD the type is not decoration: it points to the token's rulebook, and the coin's own data records how many tokens it holds. So a token payment must balance two things at once, the CKB capacity and the token amount. A plain coin has only a lock; a token coin has both, and it still reserves ordinary CKB in order to exist.",
    render: () => (
      <div className="flex flex-col items-center gap-8">
        <CellCoin value={100} owner="A" type="RUSD" size={116} interactive />
        <div className="flex flex-wrap justify-center gap-10">
          <div className="flex items-center gap-2">
            <Padlock size={22} color={ALICE} />
            <span className="mono text-[11px] text-bone-dim">Lock: who is allowed to spend it</span>
          </div>
          <div className="flex items-center gap-2">
            <Stamp label="RUSD" />
            <span className="mono text-[11px] text-bone-dim">Type: what the coin is</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'capacity',
    label: 'Why coins have a size',
    kicker: 'Storage costs CKB',
    title: 'A coin reserves space, and space costs CKB',
    body: "Holding a coin means reserving room on the blockchain to store it. That room is called capacity, and it is measured in CKB, where one byte of storage costs one CKB. A coin's size and its CKB value are the same thing. A plain coin needs at least 61 CKB for its lock and basic fields. A token coin needs more, about 142 CKB, because it also carries a type script (its rulebook) and the token amount. This CKB is reserved rather than spent, so destroying the coin frees it again. Toggle between a plain and a token coin, and add data, to see the size change.",
    render: () => <CapacityScene />,
  },
  {
    id: 'send',
    label: 'Making a payment',
    kicker: 'Old coins in, new coins out',
    title: 'How a payment actually works',
    body: "Here is the payment itself. Alice's coins are taken out of her wallet and destroyed by the transaction. In their place the transaction creates new coins: one for Bob, and one that returns Alice's change. That change is a brand new coin with its own identity, not the same coin handed back. A small amount called the fee is kept by the miner who records the transaction, which is why the new coins add up to a little less than the old ones. Drag the amount, then press Sign and send. You can send again and again: each payment leaves Alice with a little less and adds another coin to Bob's wallet, just like spending in real life. Press Reset to start over.",
    render: (ctx) => <SendScene ctx={ctx} />,
  },
  {
    id: 'compose',
    label: 'Build a tx',
    kicker: 'Now you try',
    title: 'Build a transaction yourself',
    body: 'A transaction has to balance: the coins Alice spends (the inputs) must equal what it creates (the outputs) plus the fee. Tap Alice’s coins to choose which ones to spend, and set how much to pay Bob. Watch the change and the fee. It only works when the sum balances, and any change coin must be at least 61 CKB, so you cannot leave a tiny leftover.',
    render: () => <ComposerScene />,
  },
  {
    id: 'lifecycle',
    label: 'The life of a tx',
    kicker: 'From signed to settled',
    title: 'What happens after you press send',
    body: 'A transaction does not settle the instant it is signed. It moves through several stages first. It is broadcast to the network, waits in a shared pool while a node checks its rules, and is then recorded into a block in two steps. Click any stage on the road to read what happens there. Switch to an invalid transaction to see what a node does when a rule fails.',
    render: () => <LifecycleScene />,
  },
  {
    id: 'recap',
    label: 'Recap',
    kicker: 'Putting it together',
    title: 'The same idea, in the real words',
    body: 'That is the whole model. Your money lives in coins called cells, each guarded by a lock and sometimes a type, and a payment destroys some coins and creates new ones. The visualizer uses the real CKB names for these things. Here is how the words you just learned map to what you will see on screen, so you recognise every part of a real transaction.',
    render: () => <RecapLegend />,
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
        <div className="flex flex-col items-center justify-between gap-3 border border-hairline bg-inset px-4 py-5">
          <span className="meta-label-sm" style={{ color: 'var(--color-bone-dim)' }}>The account model · a bank</span>
          <BankBuilding size={92} />
          <div className="flex w-full flex-col items-center gap-1 border-t border-hairline pt-3">
            <span className="meta-label-sm">Alice's balance</span>
            <span key={paid ? 'a1' : 'a0'} className="learn-anim mono text-[26px] font-medium tracking-tight text-bone" style={{ animationName: 'learn-pop', animationDuration: '260ms' }}>
              {fmt(paid ? change : balance)} <span className="text-[11px] uppercase tracking-[0.1em] text-muted">CKB</span>
            </span>
            <span className="mono text-[10px] uppercase tracking-[0.12em]" aria-hidden={!paid} style={{ color: 'var(--color-alarm)' }}>
              {paid ? `paid ${fmt(send)} to Bob` : ' '}
            </span>
          </div>
          <span className="text-center text-[11px] leading-relaxed text-muted">The bank keeps one number and rewrites it.</span>
        </div>

        <div className="flex items-center justify-center">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-muted">vs</span>
        </div>

        <div className="flex flex-col items-center gap-3 border px-4 py-5" style={{ borderColor: 'color-mix(in oklab, var(--color-ember) 30%, transparent)', background: 'color-mix(in oklab, var(--color-ember) 5%, transparent)' }}>
          <span className="meta-label-sm" style={{ color: 'var(--color-ember)' }}>The UTXO model · a piggy bank</span>
          <div className="flex min-h-[112px] items-center justify-center gap-3">
            {!paid ? (
              <Wallet owner="Alice" ownerLetter="A" color={ALICE} coins={inputs} size={116} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="flex gap-0.5">
                    {inputs.map((v, k) => (
                      <CellCoin key={k} value={v} owner="A" role="input" consumed size={26} showBadge={false} interactive />
                    ))}
                  </span>
                  <span className="mono text-[8px] uppercase tracking-[0.1em] text-muted">destroyed</span>
                </div>
                <span className="mono text-[14px]" style={{ color: 'var(--color-ember)' }}>→</span>
                <Wallet owner="Bob" ownerLetter="B" color={BOB} coins={send > 0 ? [send] : []} size={92} coinRole="output" emptyLabel="none" />
                <Wallet owner="Alice" ownerLetter="A" color={ALICE} coins={change > 0 ? [change] : []} size={92} coinRole="output" emptyLabel="none" />
              </div>
            )}
          </div>
          <span className="text-center text-[11px] leading-relaxed text-muted">The old coins are destroyed and new coins are created.</span>
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

/* ── cells: a balance is a stack of coins ───────────────────────────────── */

function CellsScene({ balance }: { balance: number }) {
  const [revealed, setRevealed] = useState(false)
  const coins = splitBalance(balance)
  return (
    <div className="flex flex-col items-center gap-5">
      <Avatar name="Alice" color={ALICE} size={48} />
      <PiggyBank size={116} color={ALICE} />
      <div className="flex flex-col items-center gap-2">
        <span className="meta-label-sm">inside her wallet</span>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {coins.map((v, k) => (
            <CellCoin key={k} value={v} owner="A" size={50} interactive />
          ))}
        </div>
      </div>
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mono border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-ember hover:text-ember"
        >
          Where is her {fmt(balance)} CKB stored?
        </button>
      ) : (
        <div className="learn-anim flex flex-col items-center gap-1.5" style={{ animationName: 'learn-pop', animationDuration: '260ms' }}>
          <span className="mono text-[13px] text-bone">
            {coins.map((v, k) => (
              <span key={k}>
                {fmt(v)}
                {k < coins.length - 1 ? ' + ' : ''}
              </span>
            ))}{' '}
            = <span style={{ color: 'var(--color-ember)' }}>{fmt(balance)} CKB</span>
          </span>
          <span className="mono max-w-sm text-center text-[11px] text-muted">
            Nowhere. There is no stored balance. It is only these {coins.length} coins added up.
          </span>
        </div>
      )}
    </div>
  )
}

/* ── capacity ───────────────────────────────────────────────────────────── */

// A cell's occupied capacity, per RFC 0019: 8 bytes for the capacity field, plus
// each script (32-byte code hash + 1 hash-type byte + args), plus the data. A
// plain cell with a Secp256k1 lock (20-byte args) floors at 8 + 53 = 61 CKB. A
// token cell adds a type script (~65) and a 16-byte amount, so it floors near 142.
const CAP_BASE = 61
const CAP_TYPE = 65
const CAP_AMOUNT = 16

function capacityCaption(token: boolean, extra: number): string {
  if (token) {
    const tail = extra > 0 ? `, plus ${extra} for extra data` : ''
    return `A token coin reserves about ${CAP_BASE + CAP_TYPE + CAP_AMOUNT + extra} CKB: the 61 base, a 65-byte type script (its rulebook), and 16 bytes for the amount${tail}.`
  }
  if (extra === 0) return 'An empty coin reserves 61 CKB: 8 bytes for its capacity field and 53 for its lock.'
  return `A plain coin reserves ${CAP_BASE + extra} CKB: the 61 base plus ${extra} bytes of data.`
}

function CapacityScene() {
  const [token, setToken] = useState(false)
  const [extra, setExtra] = useState(0)
  const typeBytes = token ? CAP_TYPE : 0
  const amountBytes = token ? CAP_AMOUNT : 0
  const total = CAP_BASE + typeBytes + amountBytes + extra
  const barMax = 320
  const seg = (n: number) => `${(n / barMax) * 100}%`
  const coinSize = Math.round(58 + Math.min(1, (total - CAP_BASE) / 240) * 82)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5">
      <div className="inline-flex border border-border">
        {([['plain', 'Plain coin'], ['token', 'Token coin']] as const).map(([k, labelText]) => {
          const on = (k === 'token') === token
          return (
            <button
              key={k}
              type="button"
              onClick={() => setToken(k === 'token')}
              className="mono px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors"
              style={on ? { background: 'color-mix(in oklab, var(--color-ember) 18%, transparent)', color: 'var(--color-ember)' } : { color: 'var(--color-muted)' }}
            >
              {labelText}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-center pt-4">
        <CellCoin value={total} owner="A" {...(token ? { type: 'RUSD' } : {})} size={coinSize} interactive style={{ transition: 'width 200ms ease-out, height 200ms ease-out' }} />
      </div>

      <div className="w-full">
        <div className="flex h-6 w-full overflow-hidden border border-hairline bg-inset">
          <div className="h-full" style={{ width: seg(CAP_BASE), background: 'color-mix(in oklab, var(--color-ember) 55%, transparent)' }} />
          {token && <div className="h-full transition-[width] duration-200 ease-out" style={{ width: seg(CAP_TYPE), background: 'var(--color-dep)' }} />}
          {token && <div className="h-full transition-[width] duration-200 ease-out" style={{ width: seg(CAP_AMOUNT), background: 'var(--color-flow-out)' }} />}
          <div className="h-full transition-[width] duration-200 ease-out" style={{ width: seg(extra), background: 'var(--color-flow-in)' }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-ember)' }}>■ base 61</span>
          {token && <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-dep)' }}>■ type script 65</span>}
          {token && <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-flow-out)' }}>■ amount 16</span>}
          <span className="mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-flow-in)' }}>■ data {extra}</span>
        </div>
      </div>

      <div className="w-full">
        <Slider label="Extra data (bytes)" value={extra} onChange={setExtra} max={200} tint="var(--color-flow-in)" unit="bytes" />
      </div>

      <span className="mono max-w-md text-center text-[11px] leading-relaxed text-bone-dim">
        {capacityCaption(token, extra)} This CKB is reserved, not spent: destroy the coin and you get all of it back.
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
  const { payAlice, payBob, amount, setAmount, pay, resetPay } = ctx
  const reduce = usePrefersReducedMotion()
  const [playing, setPlaying] = useState(false)
  const [flight, setFlight] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  const inputs = payAlice.length ? payAlice : [0]
  const nIn = inputs.length
  const aliceTotal = round3(payAlice.reduce((a, b) => a + b, 0))
  const bobTotal = round3(payBob.reduce((a, b) => a + b, 0))
  const maxSend = Math.max(0, round3(aliceTotal - FEE))
  const send = Math.min(amount, maxSend)
  const change = Math.max(0, round3(aliceTotal - send - FEE))
  const canSend = send > 0 && aliceTotal > FEE

  const deliverStart = nIn * STAG + ARRIVE + 60
  const playMs = deliverStart + ARRIVE + 260

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const play = () => {
    if (!canSend) return
    if (reduce) {
      pay(send)
      return
    }
    const amt = send
    setFlight((f) => f + 1)
    setPlaying(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setPlaying(false)
      pay(amt)
    }, playMs)
  }
  const doReset = () => {
    window.clearTimeout(timer.current)
    setPlaying(false)
    resetPay()
  }

  const aliceRest = playing ? [] : payAlice

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="relative" style={{ minHeight: 172 }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Alice" color={ALICE} size={44} />
            <Wallet owner="" ownerLetter="A" color={ALICE} coins={aliceRest} size={104} emptyLabel="out of coins" receiveKey={playing ? 0 : flight} />
          </div>

          <div className="flex flex-col items-center gap-2 px-2">
            <span
              className="mono grid place-items-center border px-3 py-2 text-[9px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--color-ember)', borderColor: 'var(--color-ember)', minWidth: 92 }}
            >
              transaction
            </span>
            <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">example fee {FEE} to miner</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Bob" color={BOB} size={44} />
            <Wallet owner="" ownerLetter="B" color={BOB} coins={payBob} size={104} emptyLabel="empty" receiveKey={playing ? 0 : flight} />
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
        <Stat label="Next payment" value={send} tint="var(--color-ember)" />
        <Stat label="Alice holds now" value={aliceTotal} sub={`${payAlice.length} coin${payAlice.length === 1 ? '' : 's'}`} tint={ALICE} />
        <Stat label="Bob holds now" value={bobTotal} sub={`${payBob.length} payment${payBob.length === 1 ? '' : 's'}`} tint="var(--color-flow-out)" />
      </div>

      <div className="flex flex-col gap-4 border-t border-hairline pt-4 min-[620px]:flex-row min-[620px]:items-end min-[620px]:gap-6">
        <div className="min-[620px]:flex-1">
          <Slider label="Alice sends Bob" value={send} onChange={setAmount} max={maxSend} />
        </div>
        <button
          type="button"
          onClick={play}
          disabled={playing || !canSend}
          className="mono h-9 shrink-0 border px-4 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
          style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
        >
          {playing ? 'Sending…' : canSend ? '▶ Sign & send' : 'Out of coins'}
        </button>
        <button
          type="button"
          onClick={doReset}
          disabled={playing}
          className="mono h-9 shrink-0 border border-border px-4 text-[11px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-bone-dim hover:text-bone disabled:opacity-40"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}

/* ── compose: build a balanced transaction ──────────────────────────────── */

const COMPOSER_COINS = [63, 80, 142, 200]
const CELL_FLOOR = 61
const COMPOSER_PIGGY = 118

/** Alice's wallet in the composer: the coins she has chosen to spend sit inside
 *  it and drop in as they are added; tapping one takes it back out. While the
 *  transaction plays the coins are in flight, and afterwards it holds her change. */
function AliceInputWallet({
  selected,
  playing,
  result,
  onRemove,
}: {
  selected: number[]
  playing: boolean
  result: { change: number } | null
  onRemove: (i: number) => void
}) {
  const bodyH = (COMPOSER_PIGGY * 56) / 72
  const showChange = !!result && result.change > 0
  const n = playing ? 0 : result ? (showChange ? 1 : 0) : selected.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n))))
  const pieceSize = n <= 3 ? 24 : Math.max(14, Math.round(24 * Math.sqrt(3 / n)))

  return (
    <div className="relative" style={{ width: COMPOSER_PIGGY, height: bodyH }}>
      <PiggyBank size={COMPOSER_PIGGY} color={ALICE} />
      <div
        className="absolute"
        style={{
          left: '20%',
          top: '20%',
          width: '60%',
          height: '58%',
          display: n === 0 ? 'flex' : 'grid',
          ...(n > 0 ? { gridTemplateColumns: `repeat(${cols}, auto)` } : {}),
          placeContent: 'center',
          justifyItems: 'center',
          alignItems: 'center',
          gap: 3,
        }}
      >
        {n === 0 && !playing && <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">{result ? 'no change' : 'pick coins'}</span>}
        {!playing && result && showChange && <CellCoin value={result.change} role="output" size={pieceSize} showBadge={false} />}
        {!playing &&
          !result &&
          selected.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onRemove(i)}
              title="Tap to take this coin back out"
              className="block transition-transform hover:-translate-y-0.5"
              style={{ animation: 'coin-in-slot 320ms cubic-bezier(.2,.6,.3,1) both' }}
            >
              <CellCoin value={COMPOSER_COINS[i] ?? 0} role="input" size={pieceSize} showBadge={false} />
            </button>
          ))}
      </div>
    </div>
  )
}

function ComposerScene() {
  const reduce = usePrefersReducedMotion()
  const [selected, setSelected] = useState<number[]>([])
  const [amount, setAmount] = useState(120)
  const [playing, setPlaying] = useState(false)
  const [flight, setFlight] = useState(0)
  const [result, setResult] = useState<{ bob: number; change: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const clearResult = () => {
    if (result) setResult(null)
  }
  const add = (i: number) => {
    if (playing || result) return
    setSelected((prev) => (prev.includes(i) ? prev : [...prev, i]))
  }
  const remove = (i: number) => {
    if (playing) return
    clearResult()
    setSelected((prev) => prev.filter((x) => x !== i))
  }

  const selectedVals = selected.map((i) => COMPOSER_COINS[i]).filter((v): v is number => v !== undefined)
  const inputsSum = round3(selectedVals.reduce((s, v) => s + v, 0))
  const change = round3(inputsSum - amount - FEE)
  const covers = inputsSum >= round3(amount + FEE)
  const changeTooSmall = covers && change > 0.0005 && change < CELL_FLOOR
  const balanced = covers && (change < 0.0005 || change >= CELL_FLOOR)

  const nIn = Math.max(1, selectedVals.length)
  const deliverStart = nIn * STAG + ARRIVE + 60
  const playMs = deliverStart + ARRIVE + 260

  const play = () => {
    if (!balanced || playing) return
    const bob = Math.min(amount, inputsSum)
    const ch = change
    if (reduce) {
      setResult({ bob, change: ch })
      return
    }
    setFlight((f) => f + 1)
    setPlaying(true)
    setResult(null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setPlaying(false)
      setResult({ bob, change: ch })
    }, playMs)
  }
  const reset = () => {
    window.clearTimeout(timer.current)
    setPlaying(false)
    setSelected([])
    setResult(null)
  }

  const bobCoins = result && !playing && result.bob > 0 ? [result.bob] : []

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      <div className="relative w-full" style={{ minHeight: 164 }}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Alice" color={ALICE} size={40} />
            <AliceInputWallet selected={selected} playing={playing} result={result} onRemove={remove} />
          </div>
          <div className="flex flex-col items-center gap-2 px-2">
            <span className="mono grid place-items-center border px-3 py-2 text-[9px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-ember)', borderColor: 'var(--color-ember)', minWidth: 88 }}>
              transaction
            </span>
            <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">example fee {FEE}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name="Bob" color={BOB} size={40} />
            <Wallet owner="" ownerLetter="B" color={BOB} coins={bobCoins} size={92} emptyLabel="" receiveKey={playing ? 0 : flight} />
          </div>
        </div>

        {playing && !reduce && (
          <div key={flight} className="pointer-events-none absolute inset-0">
            {selectedVals.map((v, k) => (
              <span
                key={`in-${k}`}
                className="learn-fly-outer"
                style={cssVars(
                  { position: 'absolute', top: FLY_TOP, marginLeft: -FLY_COIN / 2, marginTop: -FLY_COIN / 2, animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${k * STAG}ms both, forge-melt 260ms var(--ease-instrument) ${k * STAG + ARRIVE}ms both` },
                  { '--l0': ALICE_X, '--l1': FORGE_X },
                )}
              >
                <span className="learn-fly-inner" style={{ display: 'block', animation: `send-fly-y ${ARRIVE}ms cubic-bezier(.34,0,.5,1) ${k * STAG}ms both` }}>
                  <CellCoin value={v} role="input" size={FLY_COIN} showBadge={false} />
                </span>
              </span>
            ))}
            <span
              key="out-bob"
              className="learn-fly-outer"
              style={cssVars(
                { position: 'absolute', top: FLY_TOP, marginLeft: -FLY_COIN / 2, marginTop: -FLY_COIN / 2, animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${deliverStart}ms both` },
                { '--l0': FORGE_X, '--l1': BOB_X },
              )}
            >
              <span className="learn-fly-inner" style={{ display: 'block', animation: `send-fly-y ${ARRIVE}ms cubic-bezier(.34,0,.5,1) ${deliverStart}ms both` }}>
                <CellCoin value={Math.min(amount, inputsSum)} owner="B" role="output" size={FLY_COIN} />
              </span>
            </span>
            {change >= CELL_FLOOR && (
              <span
                key="out-change"
                className="learn-fly-outer"
                style={cssVars(
                  { position: 'absolute', top: FLY_TOP, marginLeft: -FLY_COIN / 2, marginTop: -FLY_COIN / 2, animation: `send-fly-x ${ARRIVE}ms cubic-bezier(.45,0,.55,1) ${deliverStart}ms both` },
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

      {!result && !playing && (
        <div className="flex flex-col items-center gap-2">
          <span className="meta-label-sm">Alice’s coins · tap to drop into her wallet</span>
          <div className="flex min-h-[68px] flex-wrap items-center justify-center gap-3">
            {COMPOSER_COINS.every((_, i) => selected.includes(i)) ? (
              <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">all of Alice’s coins are in her wallet</span>
            ) : (
              COMPOSER_COINS.map((v, i) =>
                selected.includes(i) ? null : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => add(i)}
                    className="flex flex-col items-center gap-1 border border-hairline p-2 transition-colors hover:border-flow-in"
                  >
                    <CellCoin value={v} owner="A" size={44} />
                    <span className="mono text-[8px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-flow-in)' }}>
                      add →
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-xs">
        <Slider
          label="Pay Bob"
          value={amount}
          onChange={(v) => {
            clearResult()
            setAmount(v)
          }}
          max={300}
        />
      </div>

      <div className="mono flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-[13px]">
        <span style={{ color: 'var(--color-flow-in)' }}>{fmt(inputsSum)}</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">in</span>
        <span className="text-muted">=</span>
        <span style={{ color: 'var(--color-flow-out)' }}>{fmt(Math.min(amount, inputsSum))}</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">bob</span>
        <span className="text-muted">+</span>
        <span style={{ color: 'var(--color-ember)' }}>{fmt(Math.max(0, change))}</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">change</span>
        <span className="text-muted">+</span>
        <span className="text-bone-dim">{FEE}</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">fee</span>
      </div>

      <div className="flex min-h-[40px] flex-col items-center justify-center gap-2 px-2 text-center">
        {result ? (
          <button type="button" onClick={reset} className="mono border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-ember hover:text-ember">
            ↺ Build another
          </button>
        ) : !covers ? (
          <span className="mono text-[11px] text-muted">Add coins worth at least {fmt(round3(amount + FEE))} CKB to cover the payment and its fee.</span>
        ) : changeTooSmall ? (
          <span className="mono max-w-sm text-[11px]" style={{ color: 'var(--color-alarm)' }}>
            The change would be {fmt(change)} CKB, below the 61 minimum. A coin cannot be that small. Add another coin, or change the amount.
          </span>
        ) : (
          <button
            type="button"
            onClick={play}
            disabled={playing}
            className="mono border px-5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--color-flow-out)', color: 'var(--color-flow-out)' }}
          >
            {playing ? 'Sending…' : 'Balanced ✓ Sign and send'}
          </button>
        )}
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
const BLOCK_NO = '13,451,922'

interface Detail {
  title: string
  desc: string
  rows: [string, string][]
  live?: 'mempool' | 'confirm'
  tone?: 'ok' | 'alarm'
}

function stageDetail(k: number, o: { invalid: boolean; rejected: boolean; confirms: number }): Detail {
  if (o.invalid && o.rejected && k === GATE) {
    return {
      title: 'Rejected at verification',
      desc: 'While the transaction sits in the pool, a node runs its lock and type scripts. One of them returns false, so the node drops the transaction here, before it can be proposed. It is never written into a block.',
      rows: [['Scripts', 'failed ✕'], ['Mempool', 'dropped'], ['On-chain', 'never recorded']],
      tone: 'alarm',
    }
  }
  switch (k) {
    case 0:
      return {
        title: 'Built & signed',
        desc: 'Alice picks her input cells, writes the output cells, and signs the transaction with her key.',
        rows: [['Inputs', '2 cells'], ['Outputs', '2 cells'], ['Fee', '0.001 CKB'], ['Witness', 'signature ✓']],
      }
    case 1:
      return {
        title: 'Broadcast',
        desc: 'The signed transaction is relayed to peers across the peer-to-peer network.',
        rows: [['Sent to', 'peers'], ['State', 'in flight']],
      }
    case 2:
      return {
        title: 'In the mempool',
        desc: 'A node re-verifies every lock and type. Valid transactions wait in the pool to be picked up by a block.',
        rows: [['Pool', 'mempool'], ['Scripts', 'checking…'], ['Awaiting', 'a proposal']],
        live: 'mempool',
      }
    case 3:
      return {
        title: 'Proposed',
        desc: 'CKB records a transaction in two steps. It is first announced in a block’s proposal zone, then a later block actually commits it a few blocks on. That gap defends against certain attacks.',
        rows: [['Step', '1 of 2 · propose'], ['Block', 'not yet']],
      }
    case 4:
      return {
        title: 'Committed',
        desc: 'A later block records the transaction. It is not instantly final: each block mined on top makes it harder to reverse, which is what the confirmation count measures.',
        rows: [['Block', `#${BLOCK_NO}`], ['Step', '2 of 2 · commit'], ['Confirmations', String(Math.max(1, o.confirms))]],
        live: 'confirm',
        tone: 'ok',
      }
    default:
      return { title: '', desc: '', rows: [] }
  }
}

function LifecycleScene() {
  const reduce = usePrefersReducedMotion()
  const [mode, setMode] = useState<'valid' | 'invalid'>('valid')
  const [stage, setStage] = useState(0)
  const [rejected, setRejected] = useState(false)
  const [runId, setRunId] = useState(0)
  const [confirms, setConfirms] = useState(0)
  const timers = useRef<number[]>([])
  const invalid = mode === 'invalid'
  const committed = !invalid && stage >= STATIONS.length - 1

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  useEffect(() => {
    clearTimers()
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
    const at = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
    if (invalid) {
      at(() => setStage(1), 750)
      at(() => setStage(GATE), 1600)
      at(() => setRejected(true), 2300)
    } else {
      at(() => setStage(1), 750)
      at(() => setStage(2), 1600)
      at(() => setStage(3), 2600)
      at(() => setStage(4), 3500)
    }
    return clearTimers
  }, [mode, reduce, invalid, runId])

  useEffect(() => {
    if (!committed || reduce) {
      setConfirms(0)
      return
    }
    setConfirms(1)
    const id = window.setInterval(() => setConfirms((c) => Math.min(c + 1, 999)), 1400)
    return () => window.clearInterval(id)
  }, [committed, reduce])

  const goTo = (k: number) => {
    clearTimers()
    if (invalid && k > GATE) return
    setStage(k)
    setRejected(invalid && k === GATE)
  }
  const replay = () => {
    clearTimers()
    setRunId((r) => r + 1)
  }

  const packetStage = invalid ? Math.min(stage, GATE) : stage
  const fillPct = (invalid ? Math.min(stage, GATE) : stage) * 25
  const detail = stageDetail(stage, { invalid, rejected, confirms })
  const total = invalid ? 3 : STATIONS.length
  const stageNo = Math.min(stage, invalid ? GATE : STATIONS.length - 1) + 1

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex items-center gap-3">
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
        <button
          type="button"
          onClick={replay}
          className="mono border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-ember hover:text-ember"
        >
          ↻ Replay
        </button>
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
            animation: rejected
              ? 'packet-reject 900ms cubic-bezier(.5,.05,.9,.5) both'
              : committed
                ? 'commit-seal 520ms cubic-bezier(.3,1.4,.5,1) both'
                : reduce
                  ? undefined
                  : 'lc-bob 2.6s ease-in-out infinite',
          }}
        >
          <TxPacket size={40} validated={!invalid && stage >= GATE} rejected={rejected} />
        </span>

        <div className="relative flex justify-between">
          {STATIONS.map((s, k) => {
            const on = invalid ? k <= GATE : stage >= k
            const isCurrent = k === packetStage && !rejected
            const isCommitted = k === STATIONS.length - 1 && committed
            const isGate = k === GATE && rejected
            const tint = isCommitted ? 'var(--color-flow-out)' : isGate ? 'var(--color-alarm)' : on ? 'var(--color-ember)' : 'var(--color-muted)'
            const disabled = invalid && k > GATE
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => goTo(k)}
                disabled={disabled}
                className="group flex flex-col items-center gap-2 disabled:cursor-default"
                style={{ maxWidth: 88 }}
              >
                <span className="relative inline-flex h-4 w-4 items-center justify-center border transition-colors group-hover:enabled:border-ember" style={{ borderColor: on ? tint : 'var(--color-border)', background: 'var(--color-panel)' }}>
                  {isCurrent && !reduce && <span style={{ position: 'absolute', inset: -3, border: `1px solid ${tint}`, animation: 'lc-pulse 1.6s ease-out infinite' }} />}
                  <span style={{ position: 'absolute', width: 8, height: 8, background: on ? tint : 'transparent', transition: 'background 220ms ease' }} />
                </span>
                <span className="mono text-[9px] uppercase tracking-[0.1em]" style={{ color: on ? (isCommitted ? 'var(--color-flow-out)' : isGate ? 'var(--color-alarm)' : 'var(--color-bone-dim)') : 'var(--color-muted)' }}>
                  {s.label}
                </span>
                <span className="mono text-center text-[8px] uppercase tracking-[0.08em] text-muted">{isGate ? 'rejected ✕' : s.sub}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="w-full max-w-lg border border-hairline bg-inset px-4 py-3" style={{ minHeight: 128 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 7, height: 7, background: detail.tone === 'alarm' ? 'var(--color-alarm)' : detail.tone === 'ok' ? 'var(--color-flow-out)' : 'var(--color-ember)' }} />
          <span className="mono text-[12px] font-medium uppercase tracking-[0.1em] text-bone">{detail.title}</span>
          <span className="mono ml-auto text-[10px] text-muted">
            stage {stageNo}/{total}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-bone-dim">{detail.desc}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
          {detail.rows.map(([k, v]) => (
            <span key={k} className="mono text-[11px]">
              <span className="text-[9px] uppercase tracking-[0.08em] text-muted">{k} </span>
              <span className="text-bone">{v}</span>
            </span>
          ))}
        </div>
        {detail.live === 'mempool' && <MempoolStrip reduce={reduce} />}
      </div>

      <span className="mono text-[10px] text-muted">click a stage to inspect it · ↻ replay to watch again</span>
    </div>
  )
}

function MempoolStrip({ reduce }: { reduce: boolean }) {
  const blips = [0, 1, 2, 3, 4, 5, 6]
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-2.5">
      <span className="mono text-[9px] uppercase tracking-[0.1em] text-muted">other pending tx</span>
      <div className="flex gap-1">
        {blips.map((i) => {
          const ours = i === 3
          return (
            <span
              key={i}
              title={ours ? "Alice's tx" : undefined}
              style={{
                width: 13,
                height: 10,
                border: `1px solid ${ours ? 'var(--color-ember)' : 'var(--color-hairline)'}`,
                background: ours ? 'color-mix(in oklab, var(--color-ember) 30%, transparent)' : 'transparent',
                animation: reduce || ours ? undefined : `lc-twinkle 2s ease-in-out ${i * 0.25}s infinite`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── recap: the metaphor-to-viewer vocabulary bridge ────────────────────── */

const LEGEND: { m: string; r: string; g: string }[] = [
  { m: 'a coin', r: 'a cell', g: 'the one unit of value' },
  { m: 'the number on a coin', r: 'Capacity', g: 'its CKB value, which is also its size' },
  { m: 'whose key can spend it', r: 'Lock script', g: 'shown as an address, ckb1… or ckt1…' },
  { m: 'the token stamp', r: 'Type script', g: 'the rulebook for a token like RUSD' },
  { m: 'a coin you spend', r: 'Input', g: 'consumed by the transaction' },
  { m: 'a coin that is created', r: 'Output', g: 'minted by the transaction' },
  { m: "a coin's identity", r: 'OutPoint', g: 'a tx hash and index; this drives lineage' },
  { m: 'proof you signed', r: 'Witness', g: 'the signature that satisfies the lock' },
  { m: "the miner's cut", r: 'Fee', g: 'inputs minus outputs' },
]

const LEGEND_TEASERS: { r: string; g: string }[] = [
  { r: 'Since', g: 'a coin that cannot be spent until a certain time or block' },
  { r: 'Lineage', g: 'follow a coin back to the coin it was minted from' },
]

function RecapLegend() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <span className="meta-label" style={{ color: 'var(--color-ember)' }}>
        what you learned → what the viewer calls it
      </span>
      <div className="flex flex-col border border-hairline">
        {LEGEND.map((row, k) => (
          <div
            key={row.r}
            className="grid grid-cols-[1fr_auto_1.5fr] items-center gap-2 px-3 py-2 min-[560px]:gap-4 min-[560px]:px-4"
            style={{ borderTop: k === 0 ? undefined : '1px solid var(--color-hairline)' }}
          >
            <span className="text-[12px] leading-tight text-bone-dim">{row.m}</span>
            <span className="mono text-[12px] text-muted">→</span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="mono text-[12px] font-medium" style={{ color: 'var(--color-ember)' }}>
                {row.r}
              </span>
              <span className="text-[11px] leading-tight text-muted">{row.g}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="meta-label-sm">two more you will meet</span>
        {LEGEND_TEASERS.map((t) => (
          <span key={t.r} className="flex flex-wrap items-baseline gap-x-2">
            <span className="mono text-[12px] font-medium" style={{ color: 'var(--color-dep)' }}>
              {t.r}
            </span>
            <span className="text-[11px] leading-tight text-muted">{t.g}</span>
          </span>
        ))}
      </div>
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
