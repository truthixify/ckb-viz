import type { Script } from './types'
import { byteLength } from './hex'

/**
 * Occupied capacity is the minimum a cell must pay for: 8 bytes for the
 * capacity field, plus each script (32-byte code hash + 1-byte hash type +
 * args), plus the data — all in bytes, one byte per shannon × 10^8 (SPEC §4).
 * A default-lock, no-data cell is 8 + 32 + 1 + 20 = 61 bytes → 61 CKB.
 */
export function occupiedCapacity(lock: Script, type: Script | undefined, dataHex: string): bigint {
  const scriptBytes = (s: Script) => 32 + 1 + byteLength(s.args)
  const bytes = 8 + scriptBytes(lock) + (type ? scriptBytes(type) : 0) + byteLength(dataHex)
  return BigInt(bytes) * 100_000_000n
}
