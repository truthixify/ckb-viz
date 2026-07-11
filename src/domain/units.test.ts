import { describe, expect, it } from 'vitest'
import { ckb, formatCkb, splitCkb, truncateHash, formatOutPoint, isValidTxHash } from './units'

describe('ckb / shannon conversion', () => {
  it('parses whole and fractional CKB exactly', () => {
    expect(ckb('10000')).toBe(1_000_000_000_000n)
    expect(ckb('999.999')).toBe(99_999_900_000n)
    expect(ckb('0.001')).toBe(100_000n)
    expect(ckb(1n)).toBe(100_000_000n)
  })

  it('formats shannons back to grouped CKB, trimming trailing zeros', () => {
    expect(formatCkb(1_000_000_000_000n)).toBe('10,000')
    expect(formatCkb(99_999_900_000n)).toBe('999.999')
    expect(formatCkb(100_000n)).toBe('0.001')
  })

  it('splits for the two-size capacity display', () => {
    expect(splitCkb(99_999_900_000n)).toEqual({ int: '999', frac: '999', negative: false })
    expect(splitCkb(1_000_000_000_000n)).toEqual({ int: '10000', frac: '', negative: false })
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
