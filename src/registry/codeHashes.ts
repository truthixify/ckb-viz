import type { HashType, Network } from '@/domain/types'

/**
 * Canonical (code_hash, hash_type) for well-known CKB scripts, per network
 * (SPEC §7.6, §16.2). These are REFERENCE DATA — verify against the live
 * deployment before trusting them for anything beyond labeling; script cells
 * can be redeployed. Names/meanings live in the registry (registry/seed.ts);
 * this module is just the identity constants, shared by the registry and the
 * bundled example fixtures.
 */

export interface Deployment {
  codeHash: string
  hashType: HashType
}

export type PerNetwork = Partial<Record<Network, Deployment>>

export const CODE_HASHES = {
  secp256k1Blake160: {
    mainnet: { codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8', hashType: 'type' },
    testnet: { codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8', hashType: 'type' },
  },
  secp256k1Multisig: {
    mainnet: { codeHash: '0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8', hashType: 'type' },
    testnet: { codeHash: '0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8', hashType: 'type' },
  },
  anyoneCanPay: {
    mainnet: { codeHash: '0xd369597ff47f29fbc0d47d2e3775370d1250b85140c670e4718af712983a2354', hashType: 'type' },
    testnet: { codeHash: '0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356', hashType: 'type' },
  },
  omnilock: {
    mainnet: { codeHash: '0x9b819793a64463aed77c615d6cb226eea5487ccfc0783043a587254cda2b6f26', hashType: 'type' },
    testnet: { codeHash: '0xf329effd1c475a2978453c8600e1eaf0bc2087ee093c3ee64cc96ec6847752cb', hashType: 'type' },
  },
  joyId: {
    mainnet: { codeHash: '0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323', hashType: 'type' },
    testnet: { codeHash: '0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac', hashType: 'type' },
  },
  rgbppLock: {
    mainnet: { codeHash: '0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936', hashType: 'type' },
    testnet: { codeHash: '0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248', hashType: 'type' },
  },
  sudt: {
    mainnet: { codeHash: '0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5', hashType: 'type' },
    testnet: { codeHash: '0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4', hashType: 'type' },
  },
  xudt: {
    mainnet: { codeHash: '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95', hashType: 'data1' },
    testnet: { codeHash: '0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb', hashType: 'type' },
  },
  nervosDao: {
    mainnet: { codeHash: '0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e', hashType: 'type' },
    testnet: { codeHash: '0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e', hashType: 'type' },
  },
  spore: {
    mainnet: { codeHash: '0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5', hashType: 'data1' },
    testnet: { codeHash: '0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d', hashType: 'data1' },
  },
  cluster: {
    mainnet: { codeHash: '0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075', hashType: 'data1' },
    testnet: { codeHash: '0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058', hashType: 'data1' },
  },
  // xUDT-compatible stablecoins / wrapped assets deploy their own type-script code.
  usdi: {
    mainnet: { codeHash: '0xbfa35a9c38a676682b65ade8f02be164d48632281477e36f8dc2f41f79e56bfc', hashType: 'type' },
  },
  rusd: {
    mainnet: { codeHash: '0x26a33e0815888a4a0614a0b7d09fa951e0993ff21e55905510104a0b1312032b', hashType: 'type' },
    testnet: { codeHash: '0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a', hashType: 'type' },
  },
  ccbtc: {
    mainnet: { codeHash: '0x092c2c4a26ea475a8e860c29cf00502103add677705e2ccd8d6fe5af3caa5ae3', hashType: 'type' },
  },
  wckb: {
    mainnet: { codeHash: '0x42a0b2aacc836c0fc2bbd421a9020de42b8411584190f30be547fdf54214acc3', hashType: 'type' },
  },
  // Additional well-known scripts.
  cheque: {
    mainnet: { codeHash: '0xe4d4ecc6e5f9a059bf2f7a82cca292083aebc0c421566a52484fe2ec51a9fb0c', hashType: 'type' },
    testnet: { codeHash: '0x60d5f39efce409c587cb9ea359cefdead650ca128f0bd9cb3855348f98c70d5b', hashType: 'type' },
  },
  btcTimeLock: {
    mainnet: { codeHash: '0x70d64497a075bd651e98ac030455ea200637ee325a12ad08aff03f1a117e5a62', hashType: 'type' },
  },
  nostrLock: {
    mainnet: { codeHash: '0x641a89ad2f77721b803cd50d01351c1f308444072d5fa20088567196c0574c68', hashType: 'type' },
    testnet: { codeHash: '0x6ae5ee0cb887b2df5a9a18137315b9bdc55be8d52637b2de0624092d5f0c91d5', hashType: 'type' },
  },
  pwLock: {
    mainnet: { codeHash: '0xbf43c3602455798c1a61a596e0d95278864c552fafe231c063b3fabf97a8febc', hashType: 'type' },
    testnet: { codeHash: '0x58c5f491aba6d61678b7cf7edf4910b1f5e00ec0cde2f42e0abb4fd9aff25a63', hashType: 'type' },
  },
  uniqueType: {
    mainnet: { codeHash: '0x2c8c11c985da60b0a330c61a85507416d6382c130ba67f0c47ab071e00aec628', hashType: 'data1' },
    testnet: { codeHash: '0x8e341bcfec6393dcd41e635733ff2dca00a6af546949f70c57a706c0f344df8b', hashType: 'type' },
  },
  cota: {
    mainnet: { codeHash: '0x1122a4fb54697cf2e6e3a96c9d80fd398a936559b90954c6e88eb7ba0cf652df', hashType: 'type' },
    testnet: { codeHash: '0x89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8', hashType: 'type' },
  },
  didCkb: {
    mainnet: { codeHash: '0x4a06164dc34dccade5afe3e847a97b6db743e79f5477fa3295acf02849c5984a', hashType: 'type' },
    testnet: { codeHash: '0x510150477b10d6ab551a509b71265f3164e9fd4137fcb5a4322f49f03092c7c5', hashType: 'type' },
  },
} as const satisfies Record<string, PerNetwork>

export type KnownScriptId = keyof typeof CODE_HASHES

/** The deployment of a known script on a network, or undefined if not deployed. */
export function deploymentFor(id: KnownScriptId, network: Network): Deployment | undefined {
  return (CODE_HASHES[id] as PerNetwork)[network]
}
