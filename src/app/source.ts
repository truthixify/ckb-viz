import type { AddressView } from '@/domain/address'
import type { Network, OutPoint, Transaction } from '@/domain/types'
import type { SourceCapabilities, TransactionSource } from '@/source/TransactionSource'
import { BundledSource } from '@/source/bundled/BundledSource'
import { getRpcUrl } from './config'

/**
 * The active source: bundled example transactions by hash (so the tool works
 * offline and lineage is walkable both ways), and the live CKB node for
 * everything else. The node adapter (and its CCC dependency) is code-split and
 * loaded on demand, so opening the tool on the bundled examples stays light.
 */
class CompositeSource implements TransactionSource {
  readonly network: Network
  readonly capabilities: SourceCapabilities = { forwardLineage: true }
  private readonly bundled: BundledSource
  private readonly rpcUrl: string
  private nodePromise?: Promise<TransactionSource>

  constructor(network: Network, rpcUrl: string) {
    this.network = network
    this.rpcUrl = rpcUrl
    this.bundled = new BundledSource(network)
  }

  private getNode(): Promise<TransactionSource> {
    if (!this.nodePromise) {
      this.nodePromise = import('@/source/node/NodeSource').then(
        (m) => new m.NodeSource(this.network, this.rpcUrl),
      )
    }
    return this.nodePromise
  }

  async getTransaction(hash: string): Promise<Transaction> {
    if (this.bundled.has(hash)) return this.bundled.getTransaction(hash)
    return (await this.getNode()).getTransaction(hash)
  }

  async findConsumingTx(outPoint: OutPoint): Promise<string | null> {
    if (this.bundled.has(outPoint.txHash)) return this.bundled.findConsumingTx(outPoint)
    return (await this.getNode()).findConsumingTx(outPoint)
  }

  async getLatestTransactionHash(): Promise<string | null> {
    return (await this.getNode()).getLatestTransactionHash()
  }

  async findExampleTransaction(kindId: string): Promise<string | null> {
    return (await this.getNode()).findExampleTransaction(kindId)
  }

  async getAddressView(address: string): Promise<AddressView> {
    return (await this.getNode()).getAddressView(address)
  }
}

export function createSource(network: Network): TransactionSource {
  return new CompositeSource(network, getRpcUrl(network))
}
