import { useMemo, useState } from 'react'
import { enrichTransaction } from '@/decode/enrich'
import { describeError } from '@/domain/errors'
import type { SimulationResult } from '@/domain/simulation'
import type { Network } from '@/domain/types'
import { formatFee, formatInt, truncateHash } from '@/domain/units'
import { ScriptRegistry } from '@/registry/registry'
import type { TransactionSource } from '@/source/TransactionSource'
import { FlowCanvas } from '@/components/flow/FlowCanvas'

/**
 * The transaction simulator. CKB has no on-chain failed transactions, so the
 * way to learn whether a transaction is valid — and why it would be rejected —
 * is to run it against current chain state. Paste a raw CKB transaction and the
 * node executes every lock and type script, reporting the cycles consumed, or
 * the failing script group and its exit code.
 */
export function SimulatePanel({
  source,
  network,
  onCopy,
  onOpenTx,
}: {
  source: TransactionSource
  network: Network
  onCopy: (text: string) => void
  onOpenTx: (hash: string) => void
}) {
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [loadingExample, setLoadingExample] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<unknown>(null)

  const registry = useMemo(() => new ScriptRegistry(network), [network])
  const enriched = useMemo(
    () => (result ? enrichTransaction(result.transaction, registry) : null),
    [result, registry],
  )

  const run = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(input)
    } catch {
      setError(new Error('That is not valid JSON. Paste a raw CKB transaction object.'))
      setResult(null)
      return
    }
    setRunning(true)
    setError(null)
    try {
      setResult(await source.simulateTransaction(parsed))
    } catch (e) {
      setResult(null)
      setError(e)
    } finally {
      setRunning(false)
    }
  }

  const loadExample = async () => {
    setLoadingExample(true)
    try {
      const json = await source.getSimulationExample()
      if (json) {
        setInput(json)
        setResult(null)
        setError(null)
      } else {
        setError(new Error('No pending transaction in the mempool right now — paste your own.'))
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoadingExample(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 border border-hairline bg-panel px-5 py-5 min-[560px]:px-7 min-[560px]:py-6">
        <div className="flex flex-col gap-2">
          <span className="meta-label">Simulate a transaction</span>
          <p className="max-w-2xl text-[13px] leading-relaxed text-bone-dim">
            Paste a raw CKB transaction to check it against the current chain state.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadExample}
            disabled={loadingExample || running}
            className="mono border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:border-ember hover:text-ember disabled:opacity-40"
          >
            {loadingExample ? 'Loading…' : 'Load a pending tx'}
          </button>
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput('')
                setResult(null)
                setError(null)
              }}
              className="mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-bone-dim"
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder='{ "version": "0x0", "cell_deps": [ … ], "inputs": [ … ], "outputs": [ … ], "outputs_data": [ … ], "witnesses": [ … ] }'
          className="well mono h-56 w-full resize-y overflow-auto p-4 text-[11px] leading-relaxed text-bone-dim placeholder:text-muted focus:border-ember focus:outline-none"
        />

        <button
          type="button"
          onClick={run}
          disabled={!input.trim() || running}
          className="mono self-start border border-border bg-panel px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:border-ember hover:text-ember disabled:opacity-40"
        >
          {running ? 'Simulating…' : 'Simulate'}
        </button>
      </section>

      {error ? <ErrorNote error={error} /> : null}

      {result && (
        <>
          <Verdict result={result} onCopy={onCopy} registry={registry} onOpenTx={onOpenTx} />
          {enriched && (
            <FlowCanvas
              transaction={enriched.transaction}
              capacity={enriched.capacity}
              selectedId={null}
              onSelectCell={() => {}}
              onCopy={onCopy}
              simulated
              failed={result.verdict === 'invalid'}
            />
          )}
        </>
      )}
    </div>
  )
}

function ErrorNote({ error }: { error: unknown }) {
  const { title, body } = describeError(error)
  return (
    <div
      className="flex flex-col gap-1 border-l-[3px] px-4 py-3"
      style={{ borderLeftColor: 'var(--color-alarm)', background: 'var(--color-panel)' }}
    >
      <span className="text-[13px] font-medium text-bone">{title}</span>
      <span className="text-[12px] text-bone-dim">{body}</span>
    </div>
  )
}

function Verdict({
  result,
  onCopy,
  registry,
  onOpenTx,
}: {
  result: SimulationResult
  onCopy: (text: string) => void
  registry: ScriptRegistry
  onOpenTx: (hash: string) => void
}) {
  const valid = result.verdict === 'valid'
  const tint = valid ? 'var(--color-flow-out)' : 'var(--color-alarm)'
  const err = result.error

  return (
    <section className="flex flex-col gap-5 border bg-panel px-5 py-5 min-[560px]:px-7 min-[560px]:py-6" style={{ borderColor: tint }}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tint }} />
        <span className="text-[20px] font-medium tracking-tight text-bone">
          {valid ? 'Would be accepted' : err?.headline ?? 'Would be rejected'}
        </span>
      </div>

      {valid ? (
        <dl className="flex flex-wrap gap-x-12 gap-y-4">
          <Reading label="Cycles">{result.cycles !== undefined ? formatInt(result.cycles) : '—'}</Reading>
          <Reading label="Fee">{formatFee(result.fee)}</Reading>
          <Reading label="Verdict">
            <span style={{ color: tint }}>Valid — scripts pass</span>
          </Reading>
        </dl>
      ) : (
        <div className="flex flex-col gap-4">
          {(err?.scriptGroup || err?.exitCode !== undefined || err?.outPoint) && (
            <dl className="flex flex-wrap gap-x-12 gap-y-4">
              {err?.scriptGroup && (
                <Reading label="Failing script">
                  <FailingScript group={err.scriptGroup} result={result} registry={registry} onOpenTx={onOpenTx} />
                </Reading>
              )}
              {err?.exitCode !== undefined && <Reading label="Exit code">{err.exitCode}</Reading>}
              {err?.outPoint && (
                <Reading label="Unresolved input">
                  <button type="button" className="mono copyable" onClick={() => onCopy(err.outPoint!)} title="Copy out-point">
                    {truncateHash(err.outPoint, 10, 8)}
                  </button>
                </Reading>
              )}
            </dl>
          )}
          {err && (
            <div className="flex flex-col gap-1.5">
              <span className="meta-label-sm">Node error</span>
              <button
                type="button"
                onClick={() => onCopy(err.raw)}
                title="Copy the raw error"
                className="well copyable mono max-h-40 overflow-auto break-all px-3 py-2 text-left text-[11px] text-bone-dim"
              >
                {err.raw}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Name the failing script group via the registry, using the tx we normalized. */
function FailingScript({
  group,
  result,
  registry,
  onOpenTx,
}: {
  group: string
  result: SimulationResult
  registry: ScriptRegistry
  onOpenTx: (hash: string) => void
}) {
  const m = group.match(/(Inputs|Outputs)\[(\d+)\]\.(Lock|Type)/)
  let name = group
  let originHash: string | undefined
  if (m) {
    const [, side, idxStr, kind] = m
    const index = Number(idxStr)
    const tx = result.transaction
    const cell = side === 'Inputs' ? tx.inputs[index]?.cell : tx.outputs[index]
    const script = kind === 'Lock' ? cell?.lock : cell?.type
    const known = script ? registry.annotate(script).known : undefined
    if (known) name = `${group} — ${known.name}`
    if (side === 'Inputs') originHash = tx.inputs[index]?.outPoint.txHash
  }
  return (
    <span className="mono flex items-center gap-2">
      <span>{name}</span>
      {originHash && (
        <button
          type="button"
          onClick={() => onOpenTx(originHash!)}
          className="text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:text-ember"
          title="Open the transaction that created this input"
        >
          origin ↗
        </button>
      )}
    </span>
  )
}

function Reading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="meta-label">{label}</dt>
      <dd className="mono text-[13px] text-bone">{children}</dd>
    </div>
  )
}
