import type { HashType, LockBinding, Script } from '@/domain/types'
import { bytesToHex, byteLength, hexToBytes, readUintLE } from '@/domain/hex'
import type { ScriptRegistry } from '@/registry/registry'
import { readTableFields } from './molecule'

/**
 * Decode the Bitcoin binding an RGB++ lock or a BTC-time lock carries in its
 * args (SPEC §8.7). Verified against the RGB++ molecule schemas and the
 * rgbpp-sdk pack/unpack code: the 32-byte txid is stored in Bitcoin internal
 * (little-endian) order, so it is reversed here to the big-endian form a
 * Bitcoin explorer shows. Best-effort: args that do not match the exact layout
 * decode to null and the caller shows nothing extra, never a guess.
 */

/** Reverse a byte slice and render as a 0x-hex string (LE txid -> display). */
function reversedHex(bytes: Uint8Array): string {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[bytes.length - 1 - i]!
  return bytesToHex(out)
}

const HASH_TYPE_BY_BYTE: Record<number, HashType> = { 0: 'data', 1: 'type', 2: 'data1', 4: 'data2' }

/** Decode a molecule `Script { code_hash: Byte32, hash_type: byte, args: Bytes }`. */
function readScript(bytes: Uint8Array): Script | null {
  try {
    const fields = readTableFields(bytesToHex(bytes))
    if (fields.length < 3) return null
    const codeHashBytes = fields[0]!
    const hashTypeBytes = fields[1]!
    const argsField = fields[2]!
    if (codeHashBytes.length !== 32 || hashTypeBytes.length !== 1) return null
    const hashType = HASH_TYPE_BY_BYTE[hashTypeBytes[0]!]
    if (!hashType) return null
    // args is a molecule Bytes: a 4-byte LE length header, then the payload.
    const args = argsField.length >= 4 ? bytesToHex(argsField.subarray(4)) : '0x'
    return { codeHash: bytesToHex(codeHashBytes), hashType, args }
  } catch {
    return null
  }
}

/**
 * RGBPPLock args: a fixed 36-byte molecule struct `{ out_index: Uint32,
 * btc_txid: Byte32 }` with no table header. The txid is stored reversed.
 */
export function decodeRgbppLock(argsHex: string): LockBinding | null {
  if (byteLength(argsHex) !== 36) return null
  try {
    const bytes = hexToBytes(argsHex)
    const btcOutIndex = Number(readUintLE(bytes, 0, 4))
    const btcTxid = reversedHex(bytes.subarray(4, 36))
    return { kind: 'rgbpp', btcTxid, btcOutIndex }
  } catch {
    return null
  }
}

/**
 * BTCTimeLock args: a molecule table `{ lock_script: Script, after: Uint32,
 * btc_txid: Byte32 }`. `after` is the required Bitcoin confirmations before the
 * cell releases to `lock_script`. The txid follows the same reversal rule.
 */
export function decodeBtcTimeLock(argsHex: string, registry: ScriptRegistry): LockBinding | null {
  try {
    const fields = readTableFields(argsHex)
    if (fields.length < 3) return null
    const ownerLockRaw = readScript(fields[0]!)
    const afterBytes = fields[1]!
    const txidBytes = fields[2]!
    if (!ownerLockRaw || afterBytes.length !== 4 || txidBytes.length !== 32) return null
    const after = Number(readUintLE(afterBytes, 0, 4))
    const btcTxid = reversedHex(txidBytes)
    const ownerLock = registry.annotate(ownerLockRaw)
    // out_index is not encoded in a BTC-time lock; the binding is to the tx.
    return { kind: 'btc-time', btcTxid, btcOutIndex: 0, after, ownerLock }
  } catch {
    return null
  }
}

/** Attach a decoded binding to a lock when it is an RGB++ or BTC-time lock. */
export function decodeLockBinding(lock: Script, registry: ScriptRegistry): LockBinding | null {
  const id = registry.identify(lock)
  if (id === 'rgbppLock') return decodeRgbppLock(lock.args)
  if (id === 'btcTimeLock') return decodeBtcTimeLock(lock.args, registry)
  return null
}
