import { describe, expect, it } from 'vitest'
import { BundledSource } from './BundledSource'
import { EXAMPLES } from './examples'

const sumOutputs = (cells: { capacity: bigint }[]) => cells.reduce((a, c) => a + c.capacity, 0n)

describe('bundled examples', () => {
  it('every example fee equals Σ inputs − Σ outputs when inputs are resolved', () => {
    for (const { id, transaction } of EXAMPLES) {
      const inputsResolved = transaction.inputs.every((i) => i.cell)
      if (!inputsResolved || transaction.fee === undefined) continue
      const inTotal = transaction.inputs.reduce((a, i) => a + (i.cell?.capacity ?? 0n), 0n)
      const outTotal = sumOutputs(transaction.outputs)
      expect(inTotal - outTotal, `fee mismatch for ${id}`).toBe(transaction.fee)
    }
  })

  it('resolves a bundled transaction by hash and rejects unknown hashes', async () => {
    const src = new BundledSource('mainnet')
    const ckbTransfer = EXAMPLES[0]!.transaction
    await expect(src.getTransaction(ckbTransfer.hash)).resolves.toMatchObject({
      hash: ckbTransfer.hash,
      network: 'mainnet',
    })
    await expect(src.getTransaction('0x' + '0'.repeat(64))).rejects.toThrow()
  })

  it('walks forward lineage where recorded', async () => {
    const src = new BundledSource('mainnet')
    const ckbTransfer = EXAMPLES[0]!.transaction
    const consumer = await src.findConsumingTx({ txHash: ckbTransfer.hash, index: 0 })
    expect(consumer).toMatch(/^0x[0-9a-f]{64}$/)
    const unspent = await src.findConsumingTx({ txHash: ckbTransfer.hash, index: 1 })
    expect(unspent).toBeNull()
  })
})
