import { describe, expect, it } from 'vitest'
import { ScriptRegistry } from '@/registry/registry'
import { EXAMPLES } from '@/source/bundled/examples'
import { bytesToHex } from '@/domain/hex'
import { decodeSince } from './since'
import { decodeUdtAmount, formatUdtAmount } from './udt'
import { decodeDaoCell } from './dao'
import { decodeSporeData } from './molecule'
import { enrichTransaction } from './enrich'

/** Encode a molecule `Bytes` (4-byte LE length prefix + bytes). */
function molBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + bytes.length)
  new DataView(out.buffer).setUint32(0, bytes.length, true)
  out.set(bytes, 4)
  return out
}
/** Encode a molecule table from its (already-encoded) field slices. */
function molTable(fields: Uint8Array[]): Uint8Array {
  const header = 4 + fields.length * 4
  const offsets: number[] = []
  let pos = header
  for (const f of fields) {
    offsets.push(pos)
    pos += f.length
  }
  const out = new Uint8Array(pos)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, pos, true)
  offsets.forEach((o, i) => dv.setUint32(4 + i * 4, o, true))
  let p = header
  for (const f of fields) {
    out.set(f, p)
    p += f.length
  }
  return out
}
function sporeData(contentType: string, content: Uint8Array): string {
  return bytesToHex(
    molTable([molBytes(new TextEncoder().encode(contentType)), molBytes(content), new Uint8Array(0)]),
  )
}

const example = (id: string) => EXAMPLES.find((e) => e.id === id)!.transaction

describe('script registry', () => {
  const registry = new ScriptRegistry('mainnet')

  it('recognizes the default lock on mainnet', () => {
    const known = registry.lookup({
      codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
      hashType: 'type',
    })
    expect(known?.shortName).toBe('Secp256k1')
    expect(known?.category).toBe('lock')
  })

  it('returns undefined for an unknown code hash — never guesses', () => {
    expect(registry.lookup({ codeHash: '0x' + 'de'.repeat(32), hashType: 'data1' })).toBeUndefined()
  })

  it('resolves the secp256k1 dep group by out-point', () => {
    const dep = {
      outPoint: { txHash: '0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c', index: 0 },
      depType: 'depGroup' as const,
    }
    expect(registry.resolveDep(dep)?.shortName).toBe('Secp256k1')
  })
})

describe('field decoders', () => {
  it('reads a UDT amount as a leading 16-byte LE u128', () => {
    // 1,500 * 10^6 = 0x59682F00, encoded as a leading 16-byte little-endian u128
    expect(decodeUdtAmount('0x002f6859000000000000000000000000')).toBe(1_500_000000n)
    expect(decodeUdtAmount('0x00')).toBeNull()
  })

  it('formats a UDT amount rounded to 2 decimal places', () => {
    expect(formatUdtAmount(19_310_736164n, 6)).toBe('19,310.74')
    expect(formatUdtAmount(1_500_000000n, 6)).toBe('1,500')
    expect(formatUdtAmount(100_500000n, 6)).toBe('100.50')
    expect(formatUdtAmount(1000n, 6)).toBe('<0.01')
    expect(formatUdtAmount(12_345678n, 8)).toBe('0.12')
  })

  it('builds a data URI for an inline image Spore, but not for a DOB', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const image = decodeSporeData(sporeData('image/png', png))
    expect(image?.contentType).toBe('image/png')
    expect(image?.imageDataUri).toBe('data:image/png;base64,' + btoa(String.fromCharCode(...png)))

    const dob = decodeSporeData(sporeData('dob/0', new Uint8Array([1, 2, 3])))
    expect(dob?.contentType).toBe('dob/0')
    expect(dob?.imageDataUri).toBeUndefined()
  })

  it('classifies a DAO deposit vs withdrawal', () => {
    expect(decodeDaoCell('0x0000000000000000')?.phase).toBe('deposit')
    expect(decodeDaoCell('0x40e2010000000000')).toEqual({ phase: 'withdraw', depositBlock: 123_456n })
    expect(decodeDaoCell('0x00')).toBeNull()
  })

  it('decodes since flag combinations', () => {
    expect(decodeSince(0n).label).toBe('no timelock')
    expect(decodeSince(0x0000000000001000n).label).toBe('absolute block 4,096')
    expect(decodeSince(0x8000000000000064n).label).toBe('relative block 100')
    expect(decodeSince(0x2000000000000064n).metric).toBe('epoch')
  })
})

describe('transaction decoder (enrichment) on bundled examples', () => {
  const registry = new ScriptRegistry('mainnet')

  it('summarizes a CKB transfer by its non-change amount', () => {
    const { summary, capacity } = enrichTransaction(example('ckb-transfer'), registry)
    expect(summary.headline).toBe('A CKB transfer of 9,000 CKB.')
    expect(summary.kind).toBe('ckb-transfer')
    expect(capacity.fee).toBe(100_000n)
  })

  it('names an xUDT token transfer with its symbol', () => {
    const { summary, transaction } = enrichTransaction(example('xudt'), registry)
    expect(summary.headline).toBe('A token transfer of 1,500 RUSD.')
    expect(transaction.outputs[0]?.decoded?.label).toBe('1,500 RUSD')
  })

  it('reads a Nervos DAO deposit', () => {
    const { summary, transaction } = enrichTransaction(example('nervos-dao'), registry)
    expect(summary.headline).toBe('A Nervos DAO deposit of 20,000 CKB.')
    expect(transaction.outputs[0]?.decoded?.kind).toBe('dao-deposit')
  })

  it('annotates known scripts and resolves the dep lane', () => {
    const { transaction } = enrichTransaction(example('ckb-transfer'), registry)
    expect(transaction.outputs[0]?.lock.known?.shortName).toBe('Secp256k1')
    expect(transaction.cellDeps[0]?.resolved?.shortName).toBe('Secp256k1')
  })

  it('leaves an unrecognized script unannotated', () => {
    const { transaction } = enrichTransaction(example('unrecognized'), registry)
    expect(transaction.outputs[0]?.lock.known).toBeUndefined()
  })
})
