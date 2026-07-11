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
 *  up) to 2 decimal places — whole amounts drop the decimals ("1,500"),
 *  fractional show exactly two ("19,310.74"), and a non-zero amount that rounds
 *  to zero shows "<0.01". */
export function formatUdtAmount(raw: bigint, decimals: number): string {
  if (decimals <= 0) return groupThousands(raw.toString())

  const displayDecimals = Math.min(decimals, DISPLAY_DECIMALS)
  const rounded =
    decimals <= DISPLAY_DECIMALS
      ? raw
      : (() => {
          const divisor = 10n ** BigInt(decimals - DISPLAY_DECIMALS)
          return (raw + divisor / 2n) / divisor
        })()
  if (rounded === 0n && raw > 0n) return '<0.01'

  const scale = 10n ** BigInt(displayDecimals)
  const whole = groupThousands((rounded / scale).toString())
  const fracNum = rounded % scale
  const frac = fracNum === 0n ? '' : fracNum.toString().padStart(displayDecimals, '0')
  return frac ? `${whole}.${frac}` : whole
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
