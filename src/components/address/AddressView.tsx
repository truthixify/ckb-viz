import type { AddressView as AddressViewData, TokenHolding } from '@/domain/address'
import { ckbParts, formatCompact, formatInt, truncateHash } from '@/domain/units'
import { formatUdtAmount } from '@/decode/udt'

/**
 * An address view (holdings + recent transactions), styled in the instrument
 * design language. CKB is the ember hero; recognized tokens get a coloured
 * badge drawn from the brand's functional palette so the page reads as more
 * than black and grey; unrecognized ones show their type identity, unguessed.
 */

const PALETTE = [
  'var(--color-ember)',
  'var(--color-flow-in)',
  'var(--color-flow-out)',
  'var(--color-dep)',
]

/** A stable colour for a known token, derived from its identity. */
function tokenColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

function initials(token: TokenHolding): string {
  if (token.symbol) return token.symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?'
  const src = (token.type.args && token.type.args !== '0x' ? token.type.args : token.type.codeHash).replace(/^0x/, '')
  return src.slice(0, 2).toUpperCase()
}

export function AddressView({
  data,
  onCopy,
  onOpenTx,
}: {
  data: AddressViewData
  onCopy: (text: string) => void
  onOpenTx: (hash: string) => void
}) {
  const { holdings, recentTxs } = data
  const { int, frac } = ckbParts(holdings.ckbBalance)

  return (
    <div className="flex flex-col gap-8">
      <section className="vz-enter flex flex-col gap-6 border border-hairline bg-panel px-5 py-5 min-[560px]:px-7 min-[560px]:py-6">
        <div className="flex flex-col gap-2">
          <span className="meta-label">Address</span>
          <button
            type="button"
            onClick={() => onCopy(holdings.address)}
            title="Copy address"
            className="mono copyable self-start break-all text-left text-[13px] text-bone-dim"
          >
            {holdings.address}
          </button>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: holdings.lock.known ? 'var(--color-ember)' : 'var(--color-muted)' }}
            />
            <span className="mono text-[11px] text-muted">
              {holdings.lock.known?.name ?? 'Unrecognized lock'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 border-t border-hairline pt-5">
          <span
            aria-hidden
            className="mono flex h-14 w-14 shrink-0 items-center justify-center border text-[13px] font-medium tracking-[0.08em]"
            style={{
              color: 'var(--color-ember)',
              borderColor: 'var(--color-ember)',
              background: 'color-mix(in oklab, var(--color-ember) 12%, transparent)',
            }}
          >
            CKB
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="meta-label">CKB balance</span>
            <span className="flex items-baseline gap-2">
              <span className="mono text-[36px] font-medium leading-none tracking-tight text-bone min-[560px]:text-[40px]">
                {int}
                {frac && <span className="text-bone-dim">.{frac}</span>}
              </span>
              <span className="mono text-[13px] uppercase tracking-[0.1em] text-muted">CKB</span>
            </span>
          </div>
        </div>
      </section>

      <section className="vz-enter flex flex-col gap-4" style={{ animationDelay: '80ms' }}>
        <SectionLabel label="Tokens" count={holdings.tokens.length} />
        {holdings.tokens.length === 0 ? (
          <p className="text-[13px] text-muted">
            No tokens found in this address's live cells{holdings.capped ? ' (first cells scanned)' : ''}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
              {holdings.tokens.map((t) => (
                <TokenCard key={`${t.type.codeHash}:${t.type.args}`} token={t} />
              ))}
            </div>
            {holdings.capped && (
              <p className="mono text-[10px] text-muted">
                Token balances summed from the first {formatInt(holdings.scannedCells)} live cells; the
                CKB balance above is exact.
              </p>
            )}
          </>
        )}
      </section>

      <section className="vz-enter flex flex-col gap-4" style={{ animationDelay: '140ms' }}>
        <SectionLabel label="Recent transactions" count={recentTxs.length} />
        {recentTxs.length === 0 ? (
          <p className="text-[13px] text-muted">No recent transactions found.</p>
        ) : (
          <div className="flex flex-col border border-hairline">
            {recentTxs.map((tx, i) => (
              <button
                key={tx.hash}
                type="button"
                onClick={() => onOpenTx(tx.hash)}
                className={`group flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-panel-2 ${
                  i > 0 ? 'border-t border-hairline' : ''
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="mono w-6 text-[10px] text-muted">{i + 1}</span>
                  <span className="mono text-[12px] text-bone-dim transition-colors group-hover:text-ember">
                    {truncateHash(tx.hash, 12, 10)}
                  </span>
                </span>
                <span className="mono text-[11px] text-muted">block {formatInt(tx.blockNumber)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="meta-label">{label}</span>
      <span className="mono text-[10px] text-muted">· {count}</span>
    </div>
  )
}

function TokenCard({ token }: { token: TokenHolding }) {
  const known = token.symbol !== undefined
  const id = `${token.type.codeHash}:${token.type.args}`
  const color = known ? tokenColor(id) : 'var(--color-muted)'
  const identifier =
    token.symbol ??
    (token.type.args && token.type.args !== '0x'
      ? truncateHash(token.type.args, 6, 6)
      : truncateHash(token.type.codeHash, 6, 6))
  const amount =
    token.decimals !== undefined ? formatUdtAmount(token.amount, token.decimals) : formatCompact(token.amount)

  return (
    <div
      className="relative flex min-w-0 items-start gap-3 border border-hairline bg-panel px-3.5 py-3.5"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <span
        aria-hidden
        className="mono flex h-10 w-10 shrink-0 items-center justify-center text-[11px] font-medium tracking-[0.04em]"
        style={{
          color,
          border: `1px solid ${color}`,
          background: known ? `color-mix(in oklab, ${color} 14%, transparent)` : 'var(--color-panel-2)',
        }}
      >
        {initials(token)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="mono min-w-0 truncate text-[13px] font-medium text-bone" title={identifier}>
            {identifier}
          </span>
          {!known && (
            <span className="mono shrink-0 text-[9px] uppercase tracking-[0.12em] text-muted">unnamed</span>
          )}
        </div>
        <span
          className="mono min-w-0 truncate text-[20px] font-medium leading-none tracking-tight text-bone"
          title={token.amount.toString()}
        >
          {amount}
        </span>
        <span className="mono truncate text-[10px] text-muted">
          {token.name ?? (known ? '' : 'Unscaled — decimals unknown')} · {token.cellCount} cell
          {token.cellCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}
