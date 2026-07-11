/** Hex parsing helpers. All chain values are "0x"-prefixed hex strings. */

export function hexToBytes(hex: string): Uint8Array {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex
  if (body.length % 2 !== 0) throw new Error('hex has an odd length')
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error('hex has non-hex characters')
    out[i] = byte
  }
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '0x'
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** Byte length of a hex string ("0x" -> 0). */
export function byteLength(hex: string): number {
  return Math.max(0, (hex.length - (hex.startsWith('0x') ? 2 : 0)) / 2)
}

/** Read a little-endian unsigned integer of `length` bytes from `bytes`. */
export function readUintLE(bytes: Uint8Array, offset: number, length: number): bigint {
  let value = 0n
  for (let i = length - 1; i >= 0; i--) {
    const byte = bytes[offset + i]
    if (byte === undefined) throw new Error('out of bounds reading little-endian integer')
    value = (value << 8n) | BigInt(byte)
  }
  return value
}
