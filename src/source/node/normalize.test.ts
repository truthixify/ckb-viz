import { describe, expect, it } from 'vitest'
import type {
  CellOutput as CccCellOutput,
  ClientBlockHeader,
  ClientTransactionResponse,
  Transaction as CccTransaction,
} from '@ckb-ccc/core'
import { cellFromCcc, normalizeTransaction } from './normalize'

const SECP = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'
const cccOut = (capacity: bigint, args: string): CccCellOutput =>
  ({ capacity, lock: { codeHash: SECP, hashType: 'type', args }, type: undefined }) as unknown as CccCellOutput

describe('CCC normalizer', () => {
  it('normalizes a resolved transaction, computing fee and occupied capacity', () => {
    const inputOut = cccOut(1_000_00000000n, '0x' + 'a'.repeat(40))
    const tx = {
      inputs: [{ previousOutput: { txHash: '0x' + 'bb'.repeat(32), index: 0n }, since: 0n }],
      outputs: [cccOut(900_00000000n, '0x' + 'c'.repeat(40)), cccOut(99_99900000n, '0x' + 'a'.repeat(40))],
      outputsData: ['0x', '0x'],
      cellDeps: [{ outPoint: { txHash: '0x' + 'dd'.repeat(32), index: 0n }, depType: 'depGroup' }],
      headerDeps: [],
      witnesses: ['0x1234'],
      toBytes: () => new Uint8Array(816),
    } as unknown as CccTransaction

    const resp = { status: 'committed', blockNumber: 42n, cycles: 1000n } as unknown as ClientTransactionResponse
    const header = { timestamp: 1_700_000_000_000n } as unknown as ClientBlockHeader
    const resolvedInput = cellFromCcc(inputOut, '0x', { txHash: '0x' + 'bb'.repeat(32), index: 0 })

    const hash = '0x' + 'ee'.repeat(32)
    const result = normalizeTransaction(hash, tx, resp, [resolvedInput], header, 'mainnet')

    expect(result.status).toBe('committed')
    expect(result.size).toBe(816)
    expect(result.blockNumber).toBe(42n)
    expect(result.timestamp).toBe(1_700_000_000_000)
    expect(result.cyclesConsumed).toBe(1000n)
    // fee = 1000 - (900 + 99.999) = 0.001 CKB
    expect(result.fee).toBe(100000n)
    expect(result.outputs[0]?.outPoint).toEqual({ txHash: hash, index: 0 })
    expect(result.cellDeps[0]?.depType).toBe('depGroup')
    // occupied = 8 + (32+1+20) + 0 data = 61 bytes -> 61 CKB
    expect(result.outputs[0]?.occupiedCapacity).toBe(61_00000000n)
  })

  it('leaves the fee undefined when an input is unresolved', () => {
    const tx = {
      inputs: [{ previousOutput: { txHash: '0x' + 'bb'.repeat(32), index: 0n }, since: 0n }],
      outputs: [cccOut(900_00000000n, '0x' + 'c'.repeat(40))],
      outputsData: ['0x'],
      cellDeps: [],
      headerDeps: [],
      witnesses: [],
      toBytes: () => new Uint8Array(200),
    } as unknown as CccTransaction
    const resp = { status: 'committed' } as unknown as ClientTransactionResponse

    const result = normalizeTransaction('0x' + 'ee'.repeat(32), tx, resp, [undefined], undefined, 'mainnet')
    expect(result.fee).toBeUndefined()
    expect(result.inputs[0]?.cell).toBeUndefined()
  })
})
