import { describe, expect, it } from 'vitest'
import type { Cell, Script, Transaction } from './types'
import { computeNetChange } from './netChange'
import { decodeSince } from '@/decode/since'

const lock = (args: string, address?: string): Script => ({
  codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
  hashType: 'type',
  args,
  ...(address ? { address } : {}),
})

const udtType = (): Script => ({
  codeHash: '0x' + '11'.repeat(32),
  hashType: 'type',
  args: '0x' + 'ab'.repeat(32),
})

const cell = (
  lockArgs: string,
  capacity: bigint,
  opts: { address?: string; udt?: bigint } = {},
): Cell => {
  const c: Cell = {
    capacity,
    occupiedCapacity: 61_00000000n,
    lock: lock(lockArgs, opts.address),
    data: '0x',
  }
  if (opts.udt !== undefined) {
    c.type = udtType()
    c.decoded = { kind: 'udt', inferred: true, udtAmount: opts.udt, udtSymbol: 'USDX', udtDecimals: 6 }
  }
  return c
}

const tx = (inputs: (Cell | undefined)[], outputs: Cell[]): Transaction => ({
  hash: '0x' + '00'.repeat(32),
  network: 'mainnet',
  status: 'committed',
  size: 0,
  inputs: inputs.map((c, i) => ({
    outPoint: { txHash: '0x' + `${i}`.padStart(2, '0').repeat(32), index: i },
    since: decodeSince(0n),
    ...(c ? { cell: c } : {}),
  })),
  outputs,
  cellDeps: [],
  headerDeps: [],
  witnesses: [],
})

describe('computeNetChange', () => {
  it('nets CKB per owner and conserves to the fee', () => {
    // Alice spends 100 CKB, keeps 39 as change; Bob receives 60; 1 CKB fee.
    const net = computeNetChange(
      tx(
        [cell('0xa11ce0', 100_00000000n, { address: 'ckb1alice' })],
        [cell('0xa11ce0', 39_00000000n, { address: 'ckb1alice' }), cell('0xb0b0', 60_00000000n, { address: 'ckb1bob' })],
      ),
    )
    expect(net.complete).toBe(true)
    const alice = net.owners.find((o) => o.address === 'ckb1alice')!
    const bob = net.owners.find((o) => o.address === 'ckb1bob')!
    expect(alice.netCkb).toBe(-61_00000000n)
    expect(bob.netCkb).toBe(60_00000000n)
    const sum = net.owners.reduce((a, o) => a + o.netCkb, 0n)
    expect(sum).toBe(-1_00000000n) // = -(fee)
  })

  it('sorts the biggest mover first', () => {
    const net = computeNetChange(
      tx(
        [cell('0xa11ce0', 100_00000000n)],
        [cell('0xa11ce0', 39_00000000n), cell('0xb0b0', 60_00000000n)],
      ),
    )
    expect(net.owners[0]?.lock.args).toBe('0xa11ce0') // -61 moves more than +60
  })

  it('nets token amounts per owner and drops zero movements', () => {
    // Alice sends 600 of a token to Bob, keeps 400 change; capacities net to zero-ish.
    const net = computeNetChange(
      tx(
        [cell('0xa11ce0', 200_00000000n, { udt: 1000n })],
        [cell('0xa11ce0', 140_00000000n, { udt: 400n }), cell('0xb0b0', 60_00000000n, { udt: 600n })],
      ),
    )
    const alice = net.owners.find((o) => o.lock.args === '0xa11ce0')!
    const bob = net.owners.find((o) => o.lock.args === '0xb0b0')!
    expect(alice.tokens[0]?.amount).toBe(-600n)
    expect(bob.tokens[0]?.amount).toBe(600n)
    expect(alice.tokens[0]?.symbol).toBe('USDX')
  })

  it('marks the net incomplete when an input is unresolved', () => {
    const net = computeNetChange(tx([undefined], [cell('0xb0b0', 60_00000000n)]))
    expect(net.complete).toBe(false)
  })
})
