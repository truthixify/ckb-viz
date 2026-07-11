import { byteLength, hexToBytes, readUintLE } from '@/domain/hex'

/**
 * Both sUDT and xUDT store the token amount in the first 16 bytes of cell data
 * as a little-endian unsigned 128-bit integer (RFC0025 / RFC0052, SPEC §8.3).
 * Returns null when the data is too short to be a valid UDT cell — never
 * assume 0.
 */
export function decodeUdtAmount(dataHex: string): bigint | null {
  if (byteLength(dataHex) < 16) return null
  try {
    return readUintLE(hexToBytes(dataHex), 0, 16)
  } catch {
    return null
  }
}

/** Scale a raw UDT integer by its decimals into a display string. */
export function formatUdtAmount(raw: bigint, decimals: number): string {
  if (decimals <= 0) return groupThousands(raw.toString())
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  const grouped = groupThousands(whole.toString())
  return frac ? `${grouped}.${frac}` : grouped
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
