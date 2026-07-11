import type { Network } from '@/domain/types'

/**
 * Per-network endpoints (SPEC §6.6). The default public nodes bundle the
 * indexer and serve permissive CORS (access-control-allow-origin: *), so the
 * browser calls them directly with no proxy. Users can point at their own node.
 */
export interface NetworkConfig {
  rpcUrl: string
}

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  mainnet: { rpcUrl: 'https://mainnet.ckb.dev/' },
  testnet: { rpcUrl: 'https://testnet.ckb.dev/' },
}
