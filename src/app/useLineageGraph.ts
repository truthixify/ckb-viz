import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Transaction } from '@/domain/types'
import type { TransactionSource } from '@/source/TransactionSource'

/**
 * The neighbourhood of a transaction in the cell-lineage DAG (SPEC §9.5): the
 * parent transactions that created its inputs, and the child transactions that
 * spent its outputs. Parents are read straight from the focus transaction (no
 * fetch — an input always names its creating transaction). Children need the
 * forward-lineage indexer, so they load lazily only when the graph is opened
 * and are bounded hard. Clicking any node re-centres the graph there, so the
 * DAG is walked hop by hop.
 */

export interface LineageNode {
  hash: string
}

/** Distinct parent transactions to show before folding into a "+N more". */
const PARENT_CAP = 8
/** Outputs to scan for a spending transaction, and children to show. */
const CHILD_OUTPUT_SCAN = 16
const CHILD_CAP = 8

export interface LineageGraph {
  parents: LineageNode[]
  parentTotal: number
  children: LineageNode[]
  childrenLoading: boolean
  forwardSupported: boolean
}

export function useLineageGraph(
  source: TransactionSource,
  focusHash: string | null,
  transaction: Transaction | undefined,
  open: boolean,
): LineageGraph {
  const parents = useMemo(() => {
    if (!transaction) return { nodes: [] as LineageNode[], total: 0 }
    const seen = new Set<string>()
    for (const input of transaction.inputs) {
      const hash = input.outPoint.txHash
      if (hash !== focusHash) seen.add(hash)
    }
    const all = [...seen]
    return { nodes: all.slice(0, PARENT_CAP).map((hash) => ({ hash })), total: all.length }
  }, [transaction, focusHash])

  const forwardSupported = source.capabilities.forwardLineage
  const childrenQuery = useQuery<LineageNode[], Error>({
    queryKey: ['lineage-children', source.network, focusHash],
    enabled: open && focusHash !== null && forwardSupported && transaction !== undefined,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async () => {
      const scan = Math.min(CHILD_OUTPUT_SCAN, transaction!.outputs.length)
      const found = new Set<string>()
      for (let i = 0; i < scan && found.size < CHILD_CAP; i++) {
        try {
          const consumer = await source.findConsumingTx({ txHash: focusHash!, index: i })
          if (consumer && consumer !== focusHash) found.add(consumer)
        } catch {
          // a single output's forward lookup failing is not fatal to the graph
        }
      }
      return [...found].map((hash) => ({ hash }))
    },
  })

  return {
    parents: parents.nodes,
    parentTotal: parents.total,
    children: childrenQuery.data ?? [],
    childrenLoading: childrenQuery.isFetching,
    forwardSupported,
  }
}
