/**
 * Capacity is held in shannons (bigint) everywhere internally and formatted to
 * CKB only here, at the edge. 1 CKB = 10^8 shannons. No floating point ever
 * touches a capacity — parsing and formatting are exact integer operations.
 */

export const SHANNON_PER_CKB = 100_000_000n
const CKB_DECIMALS = 8

/** Parse a CKB decimal string (e.g. "999.999") into an exact shannon bigint. */
export function ckb(amount: string | number | bigint): bigint {
  if (typeof amount === 'bigint') return amount * SHANNON_PER_CKB
  const s = String(amount).trim()
  const negative = s.startsWith('-')
  const unsigned = negative ? s.slice(1) : s
  const [intPart = '0', fracPartRaw = ''] = unsigned.split('.')
  const fracPart = (fracPartRaw + '0'.repeat(CKB_DECIMALS)).slice(0, CKB_DECIMALS)
  const shannons = BigInt(intPart || '0') * SHANNON_PER_CKB + BigInt(fracPart || '0')
  return negative ? -shannons : shannons
}

/** Insert thousands separators into a string of digits. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const CKB_DISPLAY_DECIMALS = 2
const SHANNON_PER_DISPLAY = 10n ** BigInt(CKB_DECIMALS - CKB_DISPLAY_DECIMALS) // 0.01 CKB

/**
 * Round shannons to 2 CKB decimals (half up) and return the display pieces for
 * the two-size capacity number on a cell. A whole amount has an empty `frac`; a
 * non-zero amount below 0.01 CKB is `tiny`.
 */
export function ckbParts(shannons: bigint): {
  negative: boolean
  int: string
  frac: string
  tiny: boolean
} {
  const negative = shannons < 0n
  const abs = negative ? -shannons : shannons
  const rounded = (abs + SHANNON_PER_DISPLAY / 2n) / SHANNON_PER_DISPLAY // units of 0.01 CKB
  const scale = 10n ** BigInt(CKB_DISPLAY_DECIMALS)
  const fracNum = rounded % scale
  return {
    negative,
    int: groupThousands((rounded / scale).toString()),
    frac: fracNum === 0n ? '' : fracNum.toString().padStart(CKB_DISPLAY_DECIMALS, '0'),
    tiny: rounded === 0n && abs > 0n,
  }
}

/** Format shannons as CKB, rounded (half up) to 2 decimals: "10,000",
 *  "1,747.90", "<0.01". Whole amounts drop the decimals; negative is signed. */
export function formatCkb(shannons: bigint): string {
  const { negative, int, frac, tiny } = ckbParts(shannons)
  if (tiny) return negative ? '>-0.01' : '<0.01'
  const body = frac ? `${int}.${frac}` : int
  return negative ? `-${body}` : body
}

/** Format a transaction fee: fees below 0.01 CKB (which round to "<0.01") are
 *  shown in shannons so the value stays legible; larger fees use 2dp CKB. */
export function formatFee(shannons: bigint | undefined): string {
  if (shannons === undefined) return '—'
  const abs = shannons < 0n ? -shannons : shannons
  if (abs < SHANNON_PER_DISPLAY) return `${formatInt(shannons)} shannon`
  return `${formatCkb(shannons)} CKB`
}

/** Plain integer with thousands separators (for cycles, size, block, counts). */
export function formatInt(value: bigint | number): string {
  const negative = typeof value === 'bigint' ? value < 0n : value < 0
  const abs = typeof value === 'bigint' ? (negative ? -value : value) : Math.abs(value)
  return (negative ? '-' : '') + groupThousands(abs.toString())
}

/** Format a byte count: "903 B", "2.1 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes % 1024 === 0 ? 0 : 1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Truncate a hash for display: "0x4c9e1a…5d6e7f". */
export function truncateHash(hash: string, lead = 6, tail = 6): string {
  if (!hash) return ''
  const body = hash.startsWith('0x') ? hash.slice(2) : hash
  if (body.length <= lead + tail) return hash
  const prefix = hash.startsWith('0x') ? '0x' : ''
  return `${prefix}${body.slice(0, lead)}…${body.slice(-tail)}`
}

/** Format an OutPoint as "0x71a7ba…72e46c:0". */
export function formatOutPoint(op: { txHash: string; index: number }): string {
  return `${truncateHash(op.txHash)}:${op.index}`
}

/** Is a string a well-formed CKB transaction hash (0x + 64 hex)? */
export function isValidTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim())
}

/** Format an epoch-ms timestamp as "2026-07-09 22:41 UTC". */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

/** Human-readable age of an epoch-ms timestamp, e.g. "5 mins ago". */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const seconds = Math.floor(Math.max(0, now - ms) / 1000)
  if (seconds < 45) return 'just now'
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return plural(minutes, 'min')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return plural(days, 'day')
  const months = Math.floor(days / 30)
  if (months < 12) return plural(months, 'month')
  return plural(Math.floor(days / 365), 'year')
}
