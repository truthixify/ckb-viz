import type { Network } from '@/domain/types'
import { isValidTxHash } from '@/domain/units'

/**
 * The app's shareable state lives in the URL: `/tx/<hash>?network=<net>`. Deep
 * links open a specific transaction; the browser history stack (with the full
 * lineage path carried in each history state entry) makes back/forward walk the
 * lineage. The home / latest view is `/?network=<net>`.
 */
export interface UrlState {
  network: Network
  path: string[]
}

export function parseLocation(): UrlState {
  const url = new URL(window.location.href)
  const network: Network = url.searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet'
  const match = url.pathname.match(/^\/tx\/(0x[0-9a-fA-F]{64})$/)
  const hash = match?.[1]
  return { network, path: hash && isValidTxHash(hash) ? [hash] : [] }
}

export function buildUrl(network: Network, hash: string | null): string {
  const query = `?network=${network}`
  return hash ? `/tx/${hash}${query}` : `/${query}`
}
