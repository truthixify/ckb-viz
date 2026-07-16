import type { AddressView as AddressViewData, TokenHolding } from '@/domain/address'
import { ckbParts, formatCompact, formatInt, truncateHash } from '@/domain/units'
import { formatUdtAmount } from '@/decode/udt'

/**
 * An address view (holdings + recent transactions), styled in the instrument
 * design language. The CKB balance is the hero reading; recognized tokens are
 * named prominently, unrecognized ones show a truncated type hash so nothing is
 * guessed. Recent transactions open in the flow.
 */
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
          <span className="mono text-[11px] text-muted">
            {holdings.lock.known?.name ?? 'Unrecognized lock'}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-hairline pt-5">
          <span className="meta-label">CKB balance</span>
          <span className="flex items-baseline gap-2">
            <span className="mono text-[40px] font-medium leading-none tracking-tight text-bone">
              {int}
              {frac && <span className="text-bone-dim">.{frac}</span>}
            </span>
            <span className="mono text-[13px] uppercase tracking-[0.1em] text-muted">CKB</span>
          </span>
        </div>
      </section>

      <section className="vz-enter flex flex-col gap-4" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2.5">
          <span className="meta-label">Tokens</span>
          <span className="mono text-[10px] text-muted">· {holdings.tokens.length}</span>
        </div>
        {holdings.tokens.length === 0 ? (
          <p className="text-[13px] text-muted">
            No tokens found in this address's live cells{holdings.capped ? ' (first cells scanned)' : ''}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
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
        <div className="flex items-center gap-2.5">
          <span className="meta-label">Recent transactions</span>
          <span className="mono text-[10px] text-muted">· {recentTxs.length}</span>
        </div>
        {recentTxs.length === 0 ? (
          <p className="text-[13px] text-muted">No recent transactions found.</p>
        ) : (
          <div className="flex flex-col border border-hairline">
            {recentTxs.map((tx, i) => (
              <button
                key={tx.hash}
                type="button"
                onClick={() => onOpenTx(tx.hash)}
                className={`flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-panel-2 ${
                  i > 0 ? 'border-t border-hairline' : ''
                }`}
              >
                <span className="mono text-[12px] text-bone-dim">{truncateHash(tx.hash, 12, 10)}</span>
                <span className="mono text-[11px] text-muted">block {formatInt(tx.blockNumber)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TokenCard({ token }: { token: TokenHolding }) {
  const known = token.symbol !== undefined
  // A UDT's identity is its type args (owner id), not its shared code hash.
  const identifier =
    token.symbol ??
    (token.type.args && token.type.args !== '0x'
      ? truncateHash(token.type.args, 6, 6)
      : truncateHash(token.type.codeHash, 6, 6))
  const amount =
    token.decimals !== undefined
      ? formatUdtAmount(token.amount, token.decimals)
      : formatCompact(token.amount)

  return (
    <div
      className="relative flex min-w-0 flex-col gap-2.5 border border-hairline bg-panel px-4 py-3.5"
      style={{ borderLeft: `3px solid ${known ? 'var(--color-ember)' : 'var(--color-muted)'}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono min-w-0 truncate text-[13px] font-medium text-bone" title={identifier}>
          {identifier}
        </span>
        {!known && (
          <span className="mono shrink-0 text-[9px] uppercase tracking-[0.12em] text-muted">unnamed</span>
        )}
      </div>
      <span className="flex items-baseline gap-1.5">
        <span
          className="mono min-w-0 truncate text-[22px] font-medium leading-none tracking-tight text-bone"
          title={token.amount.toString()}
        >
          {amount}
        </span>
        {token.symbol && (
          <span className="mono shrink-0 text-[11px] uppercase tracking-[0.08em] text-muted">
            {token.symbol}
          </span>
        )}
      </span>
      <span className="mono truncate text-[10px] text-muted">
        {token.name ?? (known ? '' : 'Unscaled — decimals unknown')} ·{' '}
        {token.cellCount} cell{token.cellCount === 1 ? '' : 's'}
      </span>
    </div>
  )
}
