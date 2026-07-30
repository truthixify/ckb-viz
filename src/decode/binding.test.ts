import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes } from '@/domain/hex'
import { ScriptRegistry } from '@/registry/registry'
import { decodeBtcTimeLock, decodeRgbppLock } from './binding'

/** Molecule `Bytes`: 4-byte LE length header + payload. */
function molBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + bytes.length)
  new DataView(out.buffer).setUint32(0, bytes.length, true)
  out.set(bytes, 4)
  return out
}
/** Molecule table from its (already-encoded) field slices. */
function molTable(fields: Uint8Array[]): Uint8Array {
  const header = 4 + fields.length * 4
  let pos = header
  const offsets = fields.map((f) => {
    const at = pos
    pos += f.length
    return at
  })
  const out = new Uint8Array(pos)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, pos, true)
  offsets.forEach((o, i) => dv.setUint32(4 + i * 4, o, true))
  let p = header
  for (const f of fields) {
    out.set(f, p)
    p += f.length
  }
  return out
}
function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}
function reverse(bytes: Uint8Array): Uint8Array {
  return bytes.slice().reverse()
}

// A recognizable big-endian Bitcoin txid (what an explorer shows).
const DISPLAY_TXID = '0x' + 'a1b2c3d4'.repeat(8)
const TXID_BYTES = hexToBytes(DISPLAY_TXID)

describe('decodeRgbppLock', () => {
  it('reads the vout and reverses the stored txid to display order', () => {
    // struct RGBPPLock { out_index: u32 LE, btc_txid: Byte32 (stored reversed) }
    const args = bytesToHex(new Uint8Array([...u32le(7), ...reverse(TXID_BYTES)]))
    const binding = decodeRgbppLock(args)
    expect(binding).not.toBeNull()
    expect(binding!.kind).toBe('rgbpp')
    expect(binding!.btcOutIndex).toBe(7)
    expect(binding!.btcTxid).toBe(DISPLAY_TXID)
  })

  it('rejects args that are not exactly 36 bytes — never guesses', () => {
    expect(decodeRgbppLock('0x1234')).toBeNull()
    expect(decodeRgbppLock('0x' + 'ab'.repeat(40))).toBeNull()
  })
})

describe('decodeBtcTimeLock', () => {
  const registry = new ScriptRegistry('mainnet')
  const secp = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'

  it('reads the owner lock, confirmations, and reversed txid', () => {
    const ownerScript = molTable([
      hexToBytes(secp), // code_hash (32 bytes, inline)
      new Uint8Array([1]), // hash_type = type
      molBytes(hexToBytes('0x' + '11'.repeat(20))), // args (Bytes)
    ])
    const args = bytesToHex(molTable([ownerScript, u32le(6), reverse(TXID_BYTES)]))
    const binding = decodeBtcTimeLock(args, registry)
    expect(binding).not.toBeNull()
    expect(binding!.kind).toBe('btc-time')
    expect(binding!.after).toBe(6)
    expect(binding!.btcTxid).toBe(DISPLAY_TXID)
    // The owner lock re-annotates against the registry (secp256k1 default lock).
    expect(binding!.ownerLock?.known?.shortName).toBe('Secp256k1')
  })
})
