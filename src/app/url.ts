import { looksLikeAddress } from '@/domain/address'
import type { Network } from '@/domain/types'
import { isValidTxHash } from '@/domain/units'

/**
 * The app's shareable state lives in the URL: `/tx/<hash>?network=<net>` for a
 * transaction, `/address/<addr>?network=<net>` for an address view. Deep links
 * open that target; the browser history stack (with the lineage path carried in
 * each history state entry) makes back/forward walk the lineage. The home /
 * latest view is `/?network=<net>`.
 */
export interface UrlState {
  network: Network
  path: string[]
  address: string | null
  simulate: boolean
  learn: boolean
}

export function parseLocation(): UrlState {
  const url = new URL(window.location.href)
  const network: Network = url.searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet'

  if (url.pathname === '/learn') {
    return { network, path: [], address: null, simulate: false, learn: true }
  }
  if (url.pathname === '/simulate') {
    return { network, path: [], address: null, simulate: true, learn: false }
  }

  const addrMatch = url.pathname.match(/^\/address\/(ck[bt]1[0-9a-z]+)$/i)
  if (addrMatch?.[1] && looksLikeAddress(addrMatch[1])) {
    return { network, path: [], address: addrMatch[1], simulate: false, learn: false }
  }

  const txMatch = url.pathname.match(/^\/tx\/(0x[0-9a-fA-F]{64})$/)
  const hash = txMatch?.[1]
  return {
    network,
    path: hash && isValidTxHash(hash) ? [hash] : [],
    address: null,
    simulate: false,
    learn: false,
  }
}

export function buildUrl(
  network: Network,
  hash: string | null,
  address?: string | null,
  simulate?: boolean,
  learn?: boolean,
): string {
  // The learn page is a static primer that never touches the chain, so it does
  // not carry a network in its URL. The selection still rides in the history
  // state (see App), so leaving the lesson returns you to your chosen network.
  if (learn) return '/learn'
  const query = `?network=${network}`
  if (simulate) return `/simulate${query}`
  if (address) return `/address/${address}${query}`
  return hash ? `/tx/${hash}${query}` : `/${query}`
}
