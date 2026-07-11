import type { HashType, Network } from '@/domain/types'
import { deploymentFor, type KnownScriptId } from '@/registry/codeHashes'

/**
 * Curated examples: a recent real transaction of a given kind, found via the
 * node's indexer by searching for a script with FIXED args (so the search
 * orders by block and returns the most recent — a prefix search would order by
 * script args instead). This surfaces the decoder's range on demand, since the
 * network's latest transaction is usually a plain transfer.
 */
export interface ExampleKind {
  id: string
  label: string
  scriptId: KnownScriptId
  scriptType: 'lock' | 'type'
  /** The fixed args that make an exact search order by block. */
  args: string
  networks: Network[]
}

export const EXAMPLE_KINDS: ExampleKind[] = [
  { id: 'dao', label: 'Nervos DAO', scriptId: 'nervosDao', scriptType: 'type', args: '0x', networks: ['mainnet', 'testnet'] },
  { id: 'usdi', label: 'USDI', scriptId: 'usdi', scriptType: 'type', args: '0xd591ebdc69626647e056e13345fd830c8b876bb06aa07ba610479eb77153ea9f', networks: ['mainnet'] },
  { id: 'rusd', label: 'RUSD', scriptId: 'rusd', scriptType: 'type', args: '0x360c9d87b2824c357958c23e8878f686001e88e9527a08ea229e7d9ba7fe39a7', networks: ['mainnet'] },
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
