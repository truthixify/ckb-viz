import type { Network, Script } from './types'

/** A UDT balance held by an address, grouped by token identity. */
export interface TokenHolding {
  /** The UDT type script (identity + entry point to explore). */
  type: Script
  symbol?: string
  name?: string
  decimals?: number
  /** Raw summed amount (before applying decimals). */
  amount: bigint
  /** How many live cells hold this token. */
  cellCount: number
}

/** What an address holds: CKB plus any tokens. */
export interface AddressHoldings {
  address: string
  network: Network
  lock: Script
  /** Total capacity across live cells, shannons (exact — one indexer call). */
  ckbBalance: bigint
  /** Live cells scanned while summing token balances. */
  scannedCells: number
  /** True when the token scan hit its cap before finishing (CKB stays exact). */
  capped: boolean
  tokens: TokenHolding[]
}

export interface AddressView {
  holdings: AddressHoldings
  recentTxs: { hash: string; blockNumber: bigint }[]
}

/** Is this string plausibly a ckb2021 address (ckb… mainnet / ckt… testnet)? */
export function looksLikeAddress(value: string): boolean {
  return /^ck[bt]1[0-9a-z]{20,}$/i.test(value.trim())
}

/** Which network an address prefix implies, if recognizable. */
export function addressNetwork(value: string): Network | null {
  const s = value.trim().toLowerCase()
  if (s.startsWith('ckb1')) return 'mainnet'
  if (s.startsWith('ckt1')) return 'testnet'
  return null
}
