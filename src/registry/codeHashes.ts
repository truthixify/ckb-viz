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
} as const satisfies Record<string, PerNetwork>

export type KnownScriptId = keyof typeof CODE_HASHES
