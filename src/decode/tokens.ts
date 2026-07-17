import type { Network, Script } from '@/domain/types'
import { CODE_HASHES } from '@/registry/codeHashes'

/**
 * A bundled token list keyed by the UDT type script (SPEC §15.2). RFC0025/0052
 * put no human name in a UDT cell — the type args are the owner lock hash, not a
 * symbol — so a name must come from a source like this. REFERENCE DATA, verify
 * against the live chain. Standard xUDT tokens share the xUDT code hash and are
 * distinguished by args; the major stablecoins/wrapped assets deploy their own
 * type-script code and are distinguished by code hash.
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

const XUDT = CODE_HASHES.xudt.mainnet!.codeHash
const SUDT = CODE_HASHES.sudt.mainnet!.codeHash

const TOKEN_LIST: TokenEntry[] = [
  // xUDT-compatible stablecoins / wrapped assets (own code hash).
  { network: 'mainnet', codeHash: CODE_HASHES.usdi.mainnet!.codeHash, args: '0xd591ebdc69626647e056e13345fd830c8b876bb06aa07ba610479eb77153ea9f', info: { symbol: 'USDI', name: 'USDI', decimals: 6 } },
  { network: 'mainnet', codeHash: CODE_HASHES.rusd.mainnet!.codeHash, args: '0x360c9d87b2824c357958c23e8878f686001e88e9527a08ea229e7d9ba7fe39a7', info: { symbol: 'RUSD', name: 'RUSD (Stable++)', decimals: 8 } },
  { network: 'mainnet', codeHash: CODE_HASHES.ccbtc.mainnet!.codeHash, args: '0x68e64ba4b0daeeec45c1f983d6d574fca370442cafb805bc4265ef74870a4ac8', info: { symbol: 'ccBTC', name: 'ccBTC', decimals: 8 } },
  { network: 'mainnet', codeHash: CODE_HASHES.wckb.mainnet!.codeHash, args: '0x', info: { symbol: 'wCKB', name: 'Wrapped CKB', decimals: 8 } },

  // Standard xUDT tokens (shared xUDT code hash, distinguished by args).
  { network: 'mainnet', codeHash: XUDT, args: '0x2ae639d6233f9b15545573b8e78f38ff7aa6c7bf8ef6460bf1f12d0a76c09c4e', info: { symbol: 'SEAL', name: 'Seal', decimals: 8 } },
  { network: 'mainnet', codeHash: XUDT, args: '0x08875c56644d39dd9629d291357d3026debc5d22fa88d924d60ce8f16dd50e70', info: { symbol: 'RGB++', name: 'RGB++', decimals: 8 } },
  { network: 'mainnet', codeHash: XUDT, args: '0xd7b5e6117759193f963b77aa255416e080c20fa041cca521f0141e48f7904999', info: { symbol: 'STB', name: 'STB', decimals: 8 } },
  { network: 'mainnet', codeHash: XUDT, args: '0x3046219b8dd69e0513691568ea438ac6a2a356c0f2695f98a8aed3cc03a1061a', info: { symbol: 'BANK', name: 'BANK', decimals: 8 } },
  { network: 'mainnet', codeHash: XUDT, args: '0x3eb8f805aa02ee7271698359ed6264f3329ab137c1b74f2ad881432fa2d437bc', info: { symbol: 'UTXOG', name: 'UTXO OGs', decimals: 8 } },

  // Legacy sUDT (Force Bridge and older bridged assets).
  { network: 'mainnet', codeHash: SUDT, args: '0x5c4ac961a2428137f27271cf2af205e5c55156d26d9ac285ed3170e8c4cc1501', info: { symbol: 'USDC', name: 'USDC (bridged)', decimals: 6 } },
  { network: 'mainnet', codeHash: SUDT, args: '0x9657b32fcdc463e13ec9205914fd91c443822a949937ae94add9869e7f2e1de8', info: { symbol: 'ETH', name: 'ETH (bridged)', decimals: 18 } },
  { network: 'mainnet', codeHash: SUDT, args: '0x656edac5463ef828a1a95f214b56adfe8f37da148fbc7ff424905e5264297c70', info: { symbol: 'YOK', name: 'YokaiSwap', decimals: 18 } },

  // Testnet.
  { network: 'testnet', codeHash: CODE_HASHES.rusd.testnet!.codeHash, args: '0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b', info: { symbol: 'RUSD', name: 'RUSD (Stable++)', decimals: 8 } },

  // Demo token for the bundled example transactions (fabricated identity).
  { network: 'mainnet', codeHash: XUDT, args: '0xd41e' + '0'.repeat(60), info: { symbol: 'RUSD', name: 'RUSD stablecoin', decimals: 6 } },
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
