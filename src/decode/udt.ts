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

const DISPLAY_DECIMALS = 2

/** Scale a raw UDT integer by its decimals into a display string, rounded (half
 *  up) to 2 decimal places. A non-zero amount that rounds to zero shows as
 *  "<0.01" rather than "0". */
export function formatUdtAmount(raw: bigint, decimals: number): string {
  if (decimals <= 0) return groupThousands(raw.toString())

  if (decimals <= DISPLAY_DECIMALS) {
    const base = 10n ** BigInt(decimals)
    const whole = groupThousands((raw / base).toString())
    const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '')
    return frac ? `${whole}.${frac}` : whole
  }

  const divisor = 10n ** BigInt(decimals - DISPLAY_DECIMALS)
  const rounded = (raw + divisor / 2n) / divisor // in units of 10^-2
  if (rounded === 0n && raw > 0n) return '<0.01'
  const scale = 10n ** BigInt(DISPLAY_DECIMALS)
  const whole = groupThousands((rounded / scale).toString())
  const frac = (rounded % scale).toString().padStart(DISPLAY_DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
