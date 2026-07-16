import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Cell, Network } from '@/domain/types'
import { looksLikeAddress } from '@/domain/address'
import { isVizError } from '@/domain/errors'
import { ScriptRegistry } from '@/registry/registry'
import { AddressView } from '@/components/address/AddressView'
import { CopyToast } from '@/components/common/CopyToast'
import { SrSummary } from '@/components/common/SrSummary'
import { DetailPanel } from '@/components/detail/DetailPanel'
import { FlowCanvas } from '@/components/flow/FlowCanvas'
import { RawJsonView } from '@/components/flow/RawJsonView'
import { TransactionExtras } from '@/components/flow/TransactionExtras'
import { Breadcrumb } from '@/components/lineage/Breadcrumb'
import { Header } from '@/components/shell/Header'
import { SummaryBanner } from '@/components/shell/SummaryBanner'
import { ExamplesBar } from '@/components/shell/ExamplesBar'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { createSource } from './source'
import { buildUrl, parseLocation } from './url'
import { useTransaction } from './useTransaction'

function parseCellId(id: string): { side: 'input' | 'output'; index: number } | null {
  const [prefix, idx] = id.split('-')
  if (idx === undefined || idx === 'group') return null
  return { side: prefix === 'in' ? 'input' : 'output', index: Number(idx) }
}

const initialUrl = parseLocation()

export function App() {
  const [network, setNetwork] = useState<Network>(initialUrl.network)
  const [path, setPath] = useState<string[]>(initialUrl.path)
  const [address, setAddress] = useState<string | null>(initialUrl.address)
  const [inputValue, setInputValue] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [findingExample, setFindingExample] = useState<string | null>(null)

  const fromPopState = useRef(false)
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      fromPopState.current = true
      const state = e.state as { path?: string[]; network?: Network; address?: string | null } | null
      const next = state?.network ? state : parseLocation()
      setNetwork(next.network ?? 'mainnet')
      setPath(next.path ?? [])
      setAddress(next.address ?? null)
      setSelectedId(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const source = useMemo(() => createSource(network), [network])
  const registry = useMemo(() => new ScriptRegistry(network), [network])

  // The tool opens on the network's latest transaction until the user navigates.
  // An address view suspends the tx flow.
  const latestQuery = useQuery({
    queryKey: ['latest', network],
    queryFn: () => source.getLatestTransactionHash(),
    staleTime: 15_000,
    retry: 1,
    enabled: address === null,
  })
  const currentHash =
    address !== null ? null : path.length > 0 ? path[path.length - 1]! : (latestQuery.data ?? null)
  const txQuery = useTransaction(source, registry, currentHash)
  const enriched = txQuery.data

  const addressQuery = useQuery({
    queryKey: ['address', network, address],
    queryFn: () => source.getAddressView(address!),
    enabled: address !== null,
    retry: (count, error) => !isVizError(error) && count < 2,
  })

  // Reflect the displayed transaction or address in the URL (shareable),
  // carrying the lineage path in history state so back/forward restores it.
  const isFirstSync = useRef(true)
  useEffect(() => {
    const url = buildUrl(network, currentHash, address)
    const state = { path, network, address }
    if (fromPopState.current) {
      fromPopState.current = false
    } else if (isFirstSync.current || (path.length === 0 && address === null)) {
      isFirstSync.current = false
      window.history.replaceState(state, '', url)
    } else {
      window.history.pushState(state, '', url)
    }
  }, [network, currentHash, path, address])

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
    setAddress(null)
    setPath([hash])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const loadAddress = useCallback((addr: string) => {
    setAddress(addr)
    setPath([])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onSubmit = useCallback(() => {
    const value = inputValue.trim()
    if (!value) return
    if (looksLikeAddress(value)) loadAddress(value)
    else loadHash(value)
  }, [inputValue, loadAddress, loadHash])

  const onHome = useCallback(() => {
    setAddress(null)
    setPath([])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onNetwork = useCallback((next: Network) => {
    setNetwork(next)
    setAddress(null)
    setPath([])
    setSelectedId(null)
    setInputValue('')
  }, [])

  const onSelectCell = useCallback((_cell: Cell, id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }, [])

  const pickExample = useCallback(
    async (kindId: string, label: string) => {
      setFindingExample(kindId)
      try {
        const hash = await source.findExampleTransaction(kindId)
        if (hash) loadHash(hash)
        else setToast(`No recent ${label} transaction found`)
      } catch {
        setToast('Could not search for an example')
      } finally {
        setFindingExample(null)
      }
    },
    [source, loadHash],
  )

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
        onSubmit={onSubmit}
        onClear={() => setInputValue('')}
        network={network}
        onNetwork={onNetwork}
        onHome={onHome}
      />
      <ExamplesBar network={network} finding={findingExample} onPick={pickExample} />

      <main className="flex-1 overflow-x-auto px-4 py-8 min-[560px]:px-6 min-[560px]:py-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
          {address !== null ? (
            addressQuery.isLoading ? (
              <LoadingState />
            ) : addressQuery.isError ? (
              <ErrorState error={addressQuery.error} />
            ) : addressQuery.data ? (
              <AddressView data={addressQuery.data} onCopy={onCopy} onOpenTx={loadHash} />
            ) : null
          ) : currentHash === null ? (
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
              <SrSummary
                transaction={enriched.transaction}
                summary={enriched.summary}
                capacity={enriched.capacity}
              />
              <Breadcrumb path={path} onNavigate={(i) => { setPath((p) => p.slice(0, i + 1)); setSelectedId(null) }} />
              <SummaryBanner
                key={`banner-${currentHash}`}
                transaction={enriched.transaction}
                capacity={enriched.capacity}
                summary={enriched.summary}
                onCopyLink={() => {
                  void navigator.clipboard?.writeText(window.location.href)
                  setToast('Link copied')
                }}
              />
              <FlowCanvas
                key={`flow-${currentHash}`}
                transaction={enriched.transaction}
                capacity={enriched.capacity}
                selectedId={selectedId}
                onSelectCell={onSelectCell}
                onCopy={onCopy}
              />
              <TransactionExtras transaction={enriched.transaction} onCopy={onCopy} />
              <RawJsonView transaction={enriched.transaction} onCopy={onCopy} />
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
