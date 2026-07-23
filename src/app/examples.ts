import type { HashType, Network } from '@/domain/types'
import { deploymentFor, type KnownScriptId } from '@/registry/codeHashes'

/**
 * Curated examples: a recent real transaction of a given kind, found via the
 * node's indexer by searching for a script with FIXED args (so the search
 * orders by block and returns the most recent — a prefix search would order by
 * script args instead). This surfaces the decoder's range on demand, since the
 * network's latest transaction is usually a plain transfer.
 */
export type ExampleCategory = 'tokens' | 'protocols' | 'objects'

export const EXAMPLE_CATEGORIES: { id: ExampleCategory; label: string }[] = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'protocols', label: 'Protocols' },
  { id: 'objects', label: 'Digital objects' },
]

export interface ExampleKind {
  id: string
  label: string
  category: ExampleCategory
  scriptId: KnownScriptId
  scriptType: 'lock' | 'type'
  /** The args to search by — fixed (exact) or a prefix (`0x` = any). */
  args: string
  /** Exact orders results by block (fixed-args scripts); prefix orders by
   *  script args (for kinds like Spore whose args differ per cell). */
  searchMode: 'exact' | 'prefix'
  networks: Network[]
}

export const EXAMPLE_KINDS: ExampleKind[] = [
  { id: 'usdi', label: 'USDI', category: 'tokens', scriptId: 'usdi', scriptType: 'type', args: '0xd591ebdc69626647e056e13345fd830c8b876bb06aa07ba610479eb77153ea9f', searchMode: 'exact', networks: ['mainnet'] },
  { id: 'rusd', label: 'RUSD', category: 'tokens', scriptId: 'rusd', scriptType: 'type', args: '0x360c9d87b2824c357958c23e8878f686001e88e9527a08ea229e7d9ba7fe39a7', searchMode: 'exact', networks: ['mainnet'] },
  { id: 'dao', label: 'Nervos DAO', category: 'protocols', scriptId: 'nervosDao', scriptType: 'type', args: '0x', searchMode: 'exact', networks: ['mainnet', 'testnet'] },
  { id: 'spore', label: 'Spore (DOB)', category: 'objects', scriptId: 'spore', scriptType: 'type', args: '0x', searchMode: 'prefix', networks: ['mainnet', 'testnet'] },
]

export interface ExampleSearch {
  script: { codeHash: string; hashType: HashType; args: string }
  scriptType: 'lock' | 'type'
}

/** Resolve the exact indexer search for an example kind on a network, if it
 *  is deployed there. */
export function exampleSearch(kind: ExampleKind, network: Network): ExampleSearch | null {
  if (!kind.networks.includes(network)) return null
  const deployment = deploymentFor(kind.scriptId, network)
  if (!deployment) return null
  return {
    script: { codeHash: deployment.codeHash, hashType: deployment.hashType, args: kind.args },
    scriptType: kind.scriptType,
  }
}

export function examplesForNetwork(network: Network): ExampleKind[] {
  return EXAMPLE_KINDS.filter((k) => k.networks.includes(network))
}
