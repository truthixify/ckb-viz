import type { Network, Script } from '@/domain/types'
import { CODE_HASHES } from '@/registry/codeHashes'

/**
 * A minimal bundled token list keyed by the UDT type script (SPEC §15.2).
 * RFC0025/0052 put no human name in a UDT cell — the type args are the owner
 * lock hash, not a symbol — so a name must come from a source like this. Keeps
 * v1 dependency-light; unknown tokens fall back to their raw type hash.
 */
export interface TokenInfo {
  symbol: string
  name?: string
  decimals: number
}

interface TokenEntry {
  network: Network
  codeHash: string
  args: string
  info: TokenInfo
}

const TOKEN_LIST: TokenEntry[] = [
  {
    network: 'mainnet',
    codeHash: CODE_HASHES.xudt.mainnet.codeHash,
    args: '0xd41e' + '0'.repeat(60),
    info: { symbol: 'RUSD', name: 'RUSD stablecoin', decimals: 6 },
  },
]

export function lookupToken(
  network: Network,
  type: Pick<Script, 'codeHash' | 'args'>,
): TokenInfo | undefined {
  const codeHash = type.codeHash.toLowerCase()
  const args = type.args.toLowerCase()
  return TOKEN_LIST.find(
    (t) => t.network === network && t.codeHash.toLowerCase() === codeHash && t.args.toLowerCase() === args,
  )?.info
}
