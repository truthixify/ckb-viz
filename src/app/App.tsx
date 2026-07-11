import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Cell, Network } from '@/domain/types'
import { isVizError } from '@/domain/errors'
import { ScriptRegistry } from '@/registry/registry'
import { CopyToast } from '@/components/common/CopyToast'
import { DetailPanel } from '@/components/detail/DetailPanel'
import { FlowCanvas } from '@/components/flow/FlowCanvas'
import { Breadcrumb } from '@/components/lineage/Breadcrumb'
import { Header } from '@/components/shell/Header'
import { SummaryBanner } from '@/components/shell/SummaryBanner'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { createSource } from './source'
import { useTransaction } from './useTransaction'

function parseCellId(id: string): { side: 'input' | 'output'; index: number } | null {
  const [prefix, idx] = id.split('-')
  if (idx === undefined || idx === 'group') return null
  return { side: prefix === 'in' ? 'input' : 'output', index: Number(idx) }
}

export function App() {
  const [network, setNetwork] = useState<Network>('mainnet')
  const [path, setPath] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const source = useMemo(() => createSource(network), [network])
  const registry = useMemo(() => new ScriptRegistry(network), [network])

  // The tool opens on the network's latest transaction until the user navigates.
  const latestQuery = useQuery({
    queryKey: ['latest', network],
    queryFn: () => source.getLatestTransactionHash(),
    staleTime: 15_000,
    retry: 1,
  })
  const currentHash = path.length > 0 ? path[path.length - 1]! : (latestQuery.data ?? null)
  const txQuery = useTransaction(source, registry, currentHash)
  const enriched = txQuery.data

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1400)
    return () => clearTimeout(t)
  }, [toast])

  const onCopy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text)
    setToast('Copied')
  }, [])

  const loadHash = useCallback((hash: string) => {
    setPath([hash])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onHome = useCallback(() => {
    setPath([])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onNetwork = useCallback((next: Network) => {
    setNetwork(next)
    setPath([])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onSelectCell = useCallback((_cell: Cell, id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }, [])

  const traceForward = useCallback(async () => {
    const sel = selectedId ? parseCellId(selectedId) : null
    if (!sel || sel.side !== 'output' || !currentHash) return
    try {
      const consumer = await source.findConsumingTx({ txHash: currentHash, index: sel.index })
      if (consumer) {
        setPath((p) => [...p, consumer])
        setSelectedId(null)
      } else {
        setToast('No spending transaction found')
      }
    } catch (error) {
      setToast(
        isVizError(error) && error.kind === 'unsupported'
          ? 'Forward lineage not available for this source'
          : 'Could not trace forward',
      )
    }
  }, [selectedId, currentHash, source])

  const traceBackward = useCallback((cell: Cell) => {
    if (!cell.outPoint) return
    setPath((p) => [...p, cell.outPoint!.txHash])
    setSelectedId(null)
  }, [])

  const sel = selectedId ? parseCellId(selectedId) : null
  const selectedCell: Cell | undefined =
    sel && enriched
      ? sel.side === 'input'
        ? enriched.transaction.inputs[sel.index]?.cell
        : enriched.transaction.outputs[sel.index]
      : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-base text-bone">
      <Header
        value={inputValue}
        onChange={setInputValue}
        onSubmit={() => inputValue.trim() && loadHash(inputValue.trim())}
        onClear={() => setInputValue('')}
        network={network}
        onNetwork={onNetwork}
        onHome={onHome}
      />

      <main className="flex-1 overflow-x-auto px-6 py-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
          {currentHash === null ? (
            latestQuery.isLoading ? (
              <LoadingState />
            ) : latestQuery.isError ? (
              <ErrorState error={latestQuery.error} />
            ) : (
              <EmptyState />
            )
          ) : txQuery.isLoading ? (
            <LoadingState />
          ) : txQuery.isError ? (
            <ErrorState error={txQuery.error} />
          ) : enriched ? (
            <>
              <Breadcrumb path={path} onNavigate={(i) => { setPath((p) => p.slice(0, i + 1)); setSelectedId(null) }} />
              <SummaryBanner
                transaction={enriched.transaction}
                capacity={enriched.capacity}
                summary={enriched.summary}
              />
              <FlowCanvas
                transaction={enriched.transaction}
                capacity={enriched.capacity}
                selectedId={selectedId}
                onSelectCell={onSelectCell}
                onCopy={onCopy}
              />
            </>
          ) : null}
        </div>
      </main>

      {selectedCell && sel && (
        <DetailPanel
          cell={selectedCell}
          side={sel.side}
          index={sel.side === 'output' ? sel.index : undefined}
          onClose={() => setSelectedId(null)}
          onCopy={onCopy}
          canTraceForward={source.capabilities.forwardLineage}
          onTraceBackward={() => traceBackward(selectedCell)}
          onTraceForward={() => void traceForward()}
        />
      )}

      {toast && <CopyToast message={toast} />}
    </div>
  )
}
