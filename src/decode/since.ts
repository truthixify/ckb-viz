import type { DecodedSince } from '@/domain/types'
import { formatInt } from '@/domain/units'

/**
 * Decode a `since` field (RFC0017, SPEC §8.6). `since` is a u64: the high byte
 * carries flags, the low 56 bits carry the value.
 *   bit 63 (0x80): 1 = relative, 0 = absolute
 *   bits 62..61 : metric — 00 block, 01 epoch, 10 timestamp, 11 invalid
 *   bits 55..0  : the value (epoch metric packs E | I | L)
 */
export function decodeSince(raw: bigint): DecodedSince {
  if (raw === 0n) {
    return { raw, isSet: false, relative: false, metric: 'block', value: 0n, label: 'no timelock' }
  }

  const flags = Number((raw >> 56n) & 0xffn)
  const value = raw & 0x00ffffffffffffffn
  const relative = (flags & 0x80) !== 0
  const metricBits = (flags >> 5) & 0x03
  const rel = relative ? 'relative' : 'absolute'

  switch (metricBits) {
    case 0:
      return { raw, isSet: true, relative, metric: 'block', value, label: `${rel} block ${formatInt(value)}` }
    case 1: {
      const e = value & 0xffffffn
      const i = (value >> 24n) & 0xffffn
      const l = (value >> 40n) & 0xffffn
      const epoch = l === 0n ? `${e}` : `${e} + ${i}/${l}`
      return { raw, isSet: true, relative, metric: 'epoch', value, label: `${rel} epoch ${epoch}` }
    }
    case 2: {
      const secs = Number(value)
      const iso = new Date(secs * 1000).toISOString().replace('.000Z', 'Z')
      return { raw, isSet: true, relative, metric: 'timestamp', value, label: `${rel} timestamp ${iso}` }
    }
    default:
      return { raw, isSet: true, relative, metric: 'invalid', value, label: 'invalid since' }
  }
}
