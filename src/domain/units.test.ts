import { describe, expect, it } from 'vitest'
import {
  ckb,
  formatCkb,
  formatCompact,
  formatFee,
  ckbParts,
  truncateHash,
  formatOutPoint,
  isValidTxHash,
  formatRelativeTime,
} from './units'
import { looksLikeAddress, addressNetwork } from './address'

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

describe('compact numbers', () => {
  it('abbreviates large integers, keeps small ones full', () => {
    expect(formatCompact(14_713n)).toBe('14,713')
    expect(formatCompact(100_000_000_000n)).toBe('100B')
    expect(formatCompact(10_000_028_114_859n)).toBe('10T')
    expect(formatCompact(329_507_542_775_230n)).toBe('329.5T')
    expect(formatCompact(13_002_351_223_921_320n)).toBe('13Q')
  })
})

describe('address detection', () => {
  const mainnet = 'ckb1qrgqep8saj8agswr30pls73hra28ry8jlnlc3ejzh3dl2ju7xxpjxqgqqyq4fjpuy4eygc7q57mna0neuskzs3rx8gxmxqjw'
  it('recognizes ckb/ckt addresses and their network', () => {
    expect(looksLikeAddress(mainnet)).toBe(true)
    expect(addressNetwork(mainnet)).toBe('mainnet')
    expect(addressNetwork('ckt1qq...')).toBe('testnet')
    expect(looksLikeAddress('0x' + 'a'.repeat(64))).toBe(false)
    expect(looksLikeAddress('not an address')).toBe(false)
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
