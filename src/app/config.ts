import type { Network } from '@/domain/types'

/**
 * Per-network endpoints (SPEC §6.6). The default public nodes bundle the
 * indexer and serve permissive CORS (access-control-allow-origin: *), so the
 * browser calls them directly with no proxy. Users can point at their own node;
 * an override is validated and persisted in localStorage per network.
 */
export interface NetworkConfig {
  rpcUrl: string
}

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  mainnet: { rpcUrl: 'https://mainnet.ckb.dev/' },
  testnet: { rpcUrl: 'https://testnet.ckb.dev/' },
}

const storageKey = (network: Network) => `ckb-viz:rpc:${network}`

/** A pasted endpoint is a request-forgery vector, so validate before use. */
export function isValidEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/** The active RPC URL for a network — a valid saved override, else the default. */
export function getRpcUrl(network: Network): string {
  try {
    const custom = localStorage.getItem(storageKey(network))
    if (custom && isValidEndpoint(custom)) return custom
  } catch {
    // localStorage may be unavailable; fall through to the default
  }
  return NETWORK_CONFIG[network].rpcUrl
}

/** The saved custom override for a network, if any. */
export function getCustomEndpoint(network: Network): string | null {
  try {
    return localStorage.getItem(storageKey(network))
  } catch {
    return null
  }
}

export function setRpcUrl(network: Network, url: string | null): void {
  try {
    if (url) localStorage.setItem(storageKey(network), url)
    else localStorage.removeItem(storageKey(network))
  } catch {
    // ignore persistence failures
  }
}
