import type { ScriptCategory } from '@/domain/types'
import type { KnownScriptId } from './codeHashes'

/**
 * Human metadata for the well-known scripts. Combined with the per-network
 * (code_hash, hash_type) in codeHashes.ts to build the registry (SPEC §7).
 * The registry is plain data — extending it is adding an entry here.
 */
export interface ScriptMeta {
  /** Full decoded name for the detail panel. */
  name: string
  /** Short tag label that fits on a cell. */
  shortName: string
  category: ScriptCategory
  /** One-line plain-language explanation. */
  meaning: string
  docsUrl?: string
}

export const SCRIPT_META: Record<KnownScriptId, ScriptMeta> = {
  secp256k1Blake160: {
    name: 'Secp256k1 / Blake160',
    shortName: 'Secp256k1',
    category: 'lock',
    meaning:
      'The default lock. Whoever holds the private key for the blake160 public-key hash in the args can unlock the cell.',
    docsUrl: 'https://docs.nervos.org/docs/tech-explanation/glossary#secp256k1',
  },
  secp256k1Multisig: {
    name: 'Secp256k1 Multisig',
    shortName: 'Multisig',
    category: 'lock',
    meaning: 'An m-of-n multisig lock; the args commit to the signer set and the threshold.',
  },
  anyoneCanPay: {
    name: 'Anyone-Can-Pay',
    shortName: 'ACP',
    category: 'lock',
    meaning:
      'A lock that lets anyone add capacity or tokens to the cell without a signature — used for receiving.',
  },
  omnilock: {
    name: 'Omnilock',
    shortName: 'Omnilock',
    category: 'lock',
    meaning:
      'A universal lock supporting many signature schemes (secp256k1, Ethereum, Bitcoin, and more).',
  },
  joyId: {
    name: 'JoyID',
    shortName: 'JoyID',
    category: 'lock',
    meaning: 'A passkey / WebAuthn-based lock for account-less wallets.',
  },
  rgbppLock: {
    name: 'RGB++ lock',
    shortName: 'RGB++',
    category: 'lock',
    meaning: 'Binds a CKB cell to a Bitcoin UTXO for the RGB++ protocol.',
  },
  sudt: {
    name: 'Simple UDT (sUDT)',
    shortName: 'sUDT',
    category: 'type',
    meaning:
      'A fungible token. The first 16 bytes of the cell data are the balance, a little-endian u128.',
    docsUrl: 'https://docs.nervos.org/docs/tech-explanation/glossary#simple-udt',
  },
  xudt: {
    name: 'Extensible UDT (xUDT)',
    shortName: 'xUDT',
    category: 'type',
    meaning:
      'A fungible token with extensions. The leading 16 bytes of the cell data are the balance.',
  },
  nervosDao: {
    name: 'Nervos DAO',
    shortName: 'Nervos DAO',
    category: 'type',
    meaning:
      'The state-rent DAO. A deposit locks capacity to earn a share of secondary issuance; a withdrawal releases it with compensation.',
    docsUrl: 'https://docs.nervos.org/docs/tech-explanation/nervos-dao',
  },
  spore: {
    name: 'Spore',
    shortName: 'Spore',
    category: 'type',
    meaning:
      'An on-chain digital object (DOB). The data holds a content-type and content, optionally bound to a cluster.',
  },
  cluster: {
    name: 'Spore Cluster',
    shortName: 'Cluster',
    category: 'type',
    meaning: 'A collection that Spores can belong to; the data holds a name and description.',
  },
}
