import type { DepType, Network, OutPoint } from '@/domain/types'
import type { KnownScriptId } from './codeHashes'

/**
 * Well-known cell-dep out-points, per network. A CellDep references a script's
 * code but carries no name; matching its out-point here lets the flow label the
 * dep lane (e.g. "Secp256k1 dep group") instead of a bare hash. REFERENCE DATA
 * — out-points can change on redeployment; for live use, resolve type-id-backed
 * deps against the chain (SPEC §16.1). Mainnet is the primary set.
 */
export interface KnownDep {
  outPoint: OutPoint
  depType: DepType
  scriptId: KnownScriptId
}

export const KNOWN_DEPS: Record<Network, KnownDep[]> = {
  mainnet: [
    {
      outPoint: { txHash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: 0 },
      depType: 'depGroup',
      scriptId: 'secp256k1Blake160',
    },
    {
      outPoint: { txHash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: 1 },
      depType: 'depGroup',
      scriptId: 'secp256k1Multisig',
    },
    {
      outPoint: { txHash: '0xe2fb199810d49a4d8beec56718ba2593b665db9d52299a0f9e6e75416d73ff5c', index: 2 },
      depType: 'code',
      scriptId: 'nervosDao',
    },
    {
      outPoint: { txHash: '0xc7813f6a415144643970c2e88e0bb6ca6a8edc5dd7c1022746f628284a9936d5', index: 0 },
      depType: 'code',
      scriptId: 'sudt',
    },
    {
      outPoint: { txHash: '0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7', index: 0 },
      depType: 'code',
      scriptId: 'xudt',
    },
    {
      outPoint: { txHash: '0xc76edf469816aa22f416503c38d0b533d2a018e253e379f134c3985b3472c842', index: 0 },
      depType: 'code',
      scriptId: 'omnilock',
    },
  ],
  testnet: [
    {
      outPoint: { txHash: '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37', index: 0 },
      depType: 'depGroup',
      scriptId: 'secp256k1Blake160',
    },
    {
      outPoint: { txHash: '0x8f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f', index: 2 },
      depType: 'code',
      scriptId: 'nervosDao',
    },
  ],
}
