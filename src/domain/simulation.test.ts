import { describe, expect, it } from 'vitest'
import { parseSimulationError, splitOutPoint } from './simulation'
import { normalizeRawTransaction, parseRawRpcTransaction } from '@/source/node/normalize'

describe('parseSimulationError', () => {
  it('classifies a dead/unknown input (resolve failure)', () => {
    const e = parseSimulationError(
      'TransactionFailedToResolve: Unknown(OutPoint(0xb279a0c9fa5c27e00e490ca93428719d2d79f4ed527548e681a5cdd7fc6fad8500000000))',
    )
    expect(e.kind).toBe('resolve')
    expect(e.outPoint).toMatch(/^0xb279/)
  })

  it('extracts the failing script group and exit code', () => {
    const e = parseSimulationError(
      'TransactionScriptError { source: Inputs[0].Lock, cause: ValidationFailure: see error code -1 }',
    )
    expect(e.kind).toBe('script')
    expect(e.scriptGroup).toBe('Inputs[0].Lock')
    expect(e.exitCode).toBe(-1)
    expect(e.headline).toContain('Inputs[0].Lock')
  })

  it('recognizes a pool duplicate (scripts may still be valid)', () => {
    const e = parseSimulationError(
      'PoolRejectedDuplicatedTransaction: Transaction(...) already exists in transaction_pool',
    )
    expect(e.kind).toBe('pool')
  })

  it('falls back to the raw message for unknown shapes', () => {
    const e = parseSimulationError('Something entirely unexpected')
    expect(e.kind).toBe('other')
    expect(e.raw).toBe('Something entirely unexpected')
  })
})

describe('splitOutPoint', () => {
  it('splits a CKB OutPoint blob into tx hash and little-endian index', () => {
    expect(splitOutPoint('0x' + 'f6'.repeat(32) + '00000000')).toEqual({
      txHash: '0x' + 'f6'.repeat(32),
      index: 0,
    })
    expect(splitOutPoint('0x' + 'ab'.repeat(32) + '02000000')).toEqual({
      txHash: '0x' + 'ab'.repeat(32),
      index: 2,
    })
    expect(splitOutPoint('0xdeadbeef')).toBeNull()
  })
})

describe('raw transaction parsing', () => {
  const rawTx = {
    version: '0x0',
    cell_deps: [{ out_point: { tx_hash: '0x' + 'a'.repeat(64), index: '0x0' }, dep_type: 'dep_group' }],
    header_deps: [],
    inputs: [{ previous_output: { tx_hash: '0x' + 'b'.repeat(64), index: '0x1' }, since: '0x0' }],
    outputs: [
      {
        capacity: '0x' + (100n * 10n ** 8n).toString(16),
        lock: { code_hash: '0x' + 'c'.repeat(64), hash_type: 'type', args: '0xdeadbeef' },
        type: null,
      },
    ],
    outputs_data: ['0x'],
    witnesses: ['0x1234'],
  }

  it('accepts a valid raw tx and a get_transaction wrapper', () => {
    expect(() => parseRawRpcTransaction(rawTx)).not.toThrow()
    expect(() => parseRawRpcTransaction({ transaction: rawTx, tx_status: { status: 'pending' } })).not.toThrow()
  })

  it('rejects a non-transaction with a plain message', () => {
    expect(() => parseRawRpcTransaction({ foo: 1 })).toThrow(/inputs/i)
    expect(() => parseRawRpcTransaction('nope')).toThrow(/JSON object/i)
  })

  it('normalizes outputs, deps, and since without a committed hash', () => {
    const tx = normalizeRawTransaction(parseRawRpcTransaction(rawTx), [undefined], 'mainnet')
    expect(tx.status).toBe('pending')
    expect(tx.hash).toBe('')
    expect(tx.outputs[0]?.capacity).toBe(100n * 10n ** 8n)
    expect(tx.outputs[0]?.lock.args).toBe('0xdeadbeef')
    expect(tx.cellDeps[0]?.depType).toBe('depGroup')
    expect(tx.inputs[0]?.outPoint.index).toBe(1)
    expect(tx.fee).toBeUndefined() // input unresolved
  })
})
