import { describe, expect, it } from 'vitest'
import {
  ckb,
  formatCkb,
  formatFee,
  ckbParts,
  truncateHash,
  formatOutPoint,
  isValidTxHash,
  formatRelativeTime,
} from './units'

describe('ckb / shannon conversion', () => {
  it('parses whole and fractional CKB exactly', () => {
    expect(ckb('10000')).toBe(1_000_000_000_000n)
    expect(ckb('999.999')).toBe(99_999_900_000n)
    expect(ckb('0.001')).toBe(100_000n)
    expect(ckb(1n)).toBe(100_000_000n)
  })

  it('formats shannons as CKB rounded to 2 decimals', () => {
    expect(formatCkb(1_000_000_000_000n)).toBe('10,000')
    expect(formatCkb(174_790_321_000n)).toBe('1,747.90') // 1747.90321 -> 1,747.90
    expect(formatCkb(99_999_900_000n)).toBe('1,000') // 999.999 rounds up
    expect(formatCkb(40_000_000_000n)).toBe('400') // whole stays clean
    expect(formatCkb(100_000n)).toBe('<0.01') // 0.001 CKB
    expect(formatCkb(-147_922_668_736n)).toBe('-1,479.23')
  })

  it('splits into 2dp parts for the two-size capacity display', () => {
    expect(ckbParts(174_790_321_000n)).toMatchObject({ int: '1,747', frac: '90' })
    expect(ckbParts(40_000_000_000n)).toMatchObject({ int: '400', frac: '' })
  })

  it('formats fees, keeping tiny fees in shannons', () => {
    expect(formatFee(1345n)).toBe('1,345 shannon')
    expect(formatFee(undefined)).toBe('—')
    expect(formatFee(-147_922_668_736n)).toBe('-1,479.23 CKB')
  })
})

describe('hash helpers', () => {
  it('truncates in the middle', () => {
    expect(truncateHash('0x' + 'a'.repeat(64))).toBe('0xaaaaaa…aaaaaa')
  })

  it('formats an outpoint with its index', () => {
    expect(formatOutPoint({ txHash: '0x' + 'b'.repeat(64), index: 3 })).toBe('0xbbbbbb…bbbbbb:3')
  })

  it('validates tx hashes', () => {
    expect(isValidTxHash('0x' + 'a'.repeat(64))).toBe(true)
    expect(isValidTxHash('0x' + 'a'.repeat(63))).toBe(false)
    expect(isValidTxHash('deadbeef')).toBe(false)
  })
})

describe('relative time', () => {
  const now = Date.parse('2026-07-11T12:00:00Z')
  it('formats ages as "X ago"', () => {
    expect(formatRelativeTime(now - 10_000, now)).toBe('just now')
    expect(formatRelativeTime(now - 60_000, now)).toBe('1 min ago')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 mins ago')
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 hours ago')
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago')
  })
})
