import type { Network, OutPoint, Transaction } from '@/domain/types'
import { VizError } from '@/domain/errors'
import type { SourceCapabilities, TransactionSource } from '../TransactionSource'
import { CONSUMERS, EXAMPLES, LINKED_TRANSACTIONS } from './examples'

/**
 * A TransactionSource backed by the bundled example transactions, so the whole
 * tool is explorable with no endpoint configured and no network access (SPEC
 * §6.7). It records forward-lineage links, so lineage can be walked both
 * directions offline. The sample data is illustrative and does not change per
 * network; the source stamps the selected network onto what it returns.
 */
export class BundledSource implements TransactionSource {
  readonly network: Network
  readonly capabilities: SourceCapabilities = { forwardLineage: true }

  private readonly byHash: Map<string, Transaction>

  constructor(network: Network) {
    this.network = network
    this.byHash = new Map()
    for (const ex of EXAMPLES) this.byHash.set(ex.transaction.hash, ex.transaction)
    for (const t of LINKED_TRANSACTIONS) this.byHash.set(t.hash, t)
  }

  /** Is this hash one of the bundled transactions? */
  has(hash: string): boolean {
    return this.byHash.has(hash)
  }

  getTransaction(hash: string): Promise<Transaction> {
    const found = this.byHash.get(hash)
    if (!found) {
      return Promise.reject(
        new VizError('not-found', `No bundled transaction for ${hash}`),
      )
    }
    return Promise.resolve(found.network === this.network ? found : { ...found, network: this.network })
  }

  findConsumingTx(outPoint: OutPoint): Promise<string | null> {
    return Promise.resolve(CONSUMERS[`${outPoint.txHash}:${outPoint.index}`] ?? null)
  }

  getLatestTransactionHash(): Promise<string | null> {
    return Promise.resolve(EXAMPLES[0]?.transaction.hash ?? null)
  }

  findExampleTransaction(kindId: string): Promise<string | null> {
    const exampleId = kindId === 'dao' ? 'nervos-dao' : kindId === 'usdi' || kindId === 'rusd' ? 'xudt' : kindId
    return Promise.resolve(EXAMPLES.find((e) => e.id === exampleId)?.transaction.hash ?? null)
  }
}
