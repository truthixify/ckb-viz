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

/** Format shannons as a CKB string with thousands separators and trimmed
 *  trailing-zero decimals: 1_000_000_000_000n -> "10,000". */
export function formatCkb(shannons: bigint): string {
  const { int, frac } = splitCkb(shannons)
  const grouped = groupThousands(int)
  return frac ? `${grouped}.${frac}` : grouped
}

/** Split shannons into the integer and (trimmed) fractional CKB parts, for the
 *  two-size capacity display on a cell. */
export function splitCkb(shannons: bigint): { int: string; frac: string; negative: boolean } {
  const negative = shannons < 0n
  const abs = negative ? -shannons : shannons
  const int = (abs / SHANNON_PER_CKB).toString()
  const frac = (abs % SHANNON_PER_CKB).toString().padStart(CKB_DECIMALS, '0').replace(/0+$/, '')
  return { int, frac, negative }
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
