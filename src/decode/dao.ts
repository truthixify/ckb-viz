import { byteLength, hexToBytes, readUintLE } from '@/domain/hex'

/**
 * A Nervos DAO cell's data is always exactly 8 bytes (RFC0023, SPEC §8.4):
 * all-zero marks a fresh deposit; a non-zero little-endian u64 is the deposit
 * cell's block height, marking a withdrawing cell.
 */
export interface DaoReading {
  phase: 'deposit' | 'withdraw'
  depositBlock: bigint | null
}

export function decodeDaoCell(dataHex: string): DaoReading | null {
  if (byteLength(dataHex) !== 8) return null
  const value = readUintLE(hexToBytes(dataHex), 0, 8)
  return value === 0n
    ? { phase: 'deposit', depositBlock: null }
    : { phase: 'withdraw', depositBlock: value }
}
