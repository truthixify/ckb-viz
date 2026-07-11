import type { Network } from '@/domain/types'
import type { TransactionSource } from '@/source/TransactionSource'
import { BundledSource } from '@/source/bundled/BundledSource'

/**
 * Builds the active source for a network. For now everything is served by the
 * bundled examples so the tool works with no endpoint; the live node adapter
 * (CCC) is wired in behind this same factory next.
 */
export function createSource(network: Network): TransactionSource {
  return new BundledSource(network)
}
