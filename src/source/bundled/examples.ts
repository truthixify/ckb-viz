import type {
  Cell,
  CellDep,
  DecodedSince,
  Input,
  Network,
  Script,
  Transaction,
  TxStatus,
} from '@/domain/types'
import { ckb } from '@/domain/units'
import { CODE_HASHES, type KnownScriptId } from '@/registry/codeHashes'

/**
 * Bundled example transactions in the normalized SPEC §5 shape (raw — the
 * registry and decoder enrich them at load). Realistic values built on the real
 * well-known mainnet code hashes so a developer recognizes them; individual
 * hashes and args are plausible fabrications. Five categories plus parent/child
 * transactions so lineage can be walked both directions. All capacity sums are
 * computed in shannon integers so the fee is exactly in − out.
 */

export type ExampleCategory =
  | 'ckb-transfer'
  | 'xudt'
  | 'nervos-dao'
  | 'batch-payout'
  | 'unrecognized'

export interface BundledExample {
  id: ExampleCategory
  label: string
  transaction: Transaction
}

const NETWORK: Network = 'mainnet'

const NO_SINCE: DecodedSince = {
  raw: 0n,
  isSet: false,
  relative: false,
  metric: 'block',
  value: 0n,
  label: 'no timelock',
}

/** Build a deterministic, plausible 64-hex hash from a prefix and suffix. */
function h(prefix: string, suffix: string): string {
  const p = prefix.replace(/^0x/, '')
  const filler = 'a3f70b9c2e5d8a1b4c7e0d3f6a9b2c5e8d1f4a7b0c3e6d9f2a5b8c1e4d7f0a3b6'
  const need = 64 - p.length - suffix.length
  return '0x' + p + filler.slice(0, Math.max(0, need)) + suffix
}

/** A 20-byte blake160 args value from a seed nibble. */
function args20(seed: string): string {
  return '0x' + (seed.repeat(40)).slice(0, 40)
}

/** 16-byte little-endian u128 as hex, for UDT amounts. */
function u128le(value: bigint): string {
  let v = value
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += (v & 0xffn).toString(16).padStart(2, '0')
    v >>= 8n
  }
  return '0x' + out
}

function deployment(id: KnownScriptId): { codeHash: string; hashType: Script['hashType'] } {
  const d = CODE_HASHES[id][NETWORK]
  if (!d) throw new Error(`no ${NETWORK} deployment for ${id}`)
  return d
}

function knownScript(id: KnownScriptId, args: string): Script {
  const d = deployment(id)
  return { codeHash: d.codeHash, hashType: d.hashType, args }
}

/** occupied = 8 (capacity) + lock + type? + data, all in bytes -> shannons. */
function bytesOf(hex: string): number {
  return Math.max(0, (hex.length - 2) / 2)
}
function scriptBytes(s: Script): number {
  return 32 + 1 + bytesOf(s.args)
}
function occupied(lock: Script, type: Script | undefined, data: string): bigint {
  const bytes = 8 + scriptBytes(lock) + (type ? scriptBytes(type) : 0) + bytesOf(data)
  return BigInt(bytes) * 100_000_000n
}

interface CellSpec {
  capacity: bigint
  lock: Script
  type?: Script
  data?: string
  outPoint?: { txHash: string; index: number }
}

function cell(spec: CellSpec): Cell {
  const data = spec.data ?? '0x'
  const base: Cell = {
    capacity: spec.capacity,
    occupiedCapacity: occupied(spec.lock, spec.type, data),
    lock: spec.lock,
    data,
  }
  if (spec.type) base.type = spec.type
  if (spec.outPoint) base.outPoint = spec.outPoint
  return base
}

function input(outPoint: { txHash: string; index: number }, resolved?: Cell): Input {
  const base: Input = { outPoint, since: NO_SINCE }
  if (resolved) base.cell = { ...resolved, outPoint }
  return base
}

const SECP_DEP_GROUP: CellDep = {
  outPoint: { txHash: h('71a7ba', '72e46c'), index: 0 },
  depType: 'depGroup',
}
const XUDT_DEP: CellDep = {
  outPoint: { txHash: h('c1e4d7', 'a0f3b6'), index: 0 },
  depType: 'code',
}
const DAO_DEP: CellDep = {
  outPoint: { txHash: h('e2b4d6', 'f8a0c1'), index: 2 },
  depType: 'code',
}

// A plausible WitnessArgs blob carrying a 65-byte secp256k1 signature.
const SIG_WITNESS =
  '0x55000000100000005500000055000000410000004a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f900'

function tx(partial: Omit<Transaction, 'network' | 'status'> & { status?: TxStatus }): Transaction {
  return { network: NETWORK, status: partial.status ?? 'committed', ...partial }
}

// Reused lock args (distinct actors).
const ALICE = args20('a')
const BOB = args20('b')
const CAROL = args20('c')
const DAO_ADMIN = args20('d')

// ─── 1. CKB transfer (the default landing) ────────────────────────────────
const CKB_TRANSFER_HASH = h('8f2ad0c1', 'd0c9b8a7')
const PARENT_HASH = h('4c9e1a', '5d6e7f')
const CHILD_HASH = h('3b7c05', '9a1e42')

const inputCell10k = cell({ capacity: ckb('10000'), lock: knownScript('secp256k1Blake160', ALICE) })

const ckbTransfer = tx({
  hash: CKB_TRANSFER_HASH,
  status: 'committed',
  blockNumber: 13_450_120n,
  timestamp: Date.parse('2026-07-08T14:22:00Z'),
  fee: ckb('0.001'),
  size: 816,
  cyclesConsumed: 1_842_060n,
  inputs: [input({ txHash: PARENT_HASH, index: 1 }, inputCell10k)],
  outputs: [
    cell({ capacity: ckb('9000'), lock: knownScript('secp256k1Blake160', BOB) }),
    cell({ capacity: ckb('999.999'), lock: knownScript('secp256k1Blake160', ALICE) }),
  ],
  cellDeps: [SECP_DEP_GROUP],
  headerDeps: [],
  witnesses: [SIG_WITNESS],
})

// Parent: created Alice's 10,000 CKB cell at index 1.
const parentTx = tx({
  hash: PARENT_HASH,
  blockNumber: 13_449_980n,
  timestamp: Date.parse('2026-07-08T13:05:00Z'),
  fee: ckb('0.001'),
  size: 820,
  inputs: [input({ txHash: h('9f0a1b', 'c2e5d8'), index: 0 })],
  outputs: [
    cell({ capacity: ckb('4321.5'), lock: knownScript('secp256k1Blake160', CAROL) }),
    cell({ capacity: ckb('10000'), lock: knownScript('secp256k1Blake160', ALICE) }),
  ],
  cellDeps: [SECP_DEP_GROUP],
  headerDeps: [],
  witnesses: [SIG_WITNESS],
})

// Child: consumed the 9,000 CKB output #0 of the CKB transfer.
const childTx = tx({
  hash: CHILD_HASH,
  blockNumber: 13_450_260n,
  timestamp: Date.parse('2026-07-08T15:40:00Z'),
  fee: ckb('0.001'),
  size: 812,
  inputs: [input({ txHash: CKB_TRANSFER_HASH, index: 0 }, cell({ capacity: ckb('9000'), lock: knownScript('secp256k1Blake160', BOB) }))],
  outputs: [
    cell({ capacity: ckb('5000'), lock: knownScript('secp256k1Blake160', CAROL) }),
    cell({ capacity: ckb('3999.999'), lock: knownScript('secp256k1Blake160', BOB) }),
  ],
  cellDeps: [SECP_DEP_GROUP],
  headerDeps: [],
  witnesses: [SIG_WITNESS],
})

// ─── 2. xUDT token transfer ───────────────────────────────────────────────
const XUDT_HASH = h('a7d20f', 'e91b34')
// Owner lock hash (32 bytes) as the type args — how sUDT/xUDT identify a token.
const RUSD_ARGS = '0x' + ('d41e' + '00'.repeat(30)).slice(0, 64)
const xudtType = knownScript('xudt', RUSD_ARGS)

const xudtTransfer = tx({
  hash: XUDT_HASH,
  blockNumber: 13_461_770n,
  timestamp: Date.parse('2026-07-09T09:12:00Z'),
  fee: ckb('0.001'),
  size: 1_204,
  cyclesConsumed: 3_907_220n,
  inputs: [
    input(
      { txHash: h('b2c4e6', '18d3f5'), index: 0 },
      cell({ capacity: ckb('300'), lock: knownScript('secp256k1Blake160', ALICE), type: xudtType, data: u128le(2_000_000000n) }),
    ),
  ],
  outputs: [
    cell({ capacity: ckb('142'), lock: knownScript('secp256k1Blake160', BOB), type: xudtType, data: u128le(1_500_000000n) }),
    cell({ capacity: ckb('142'), lock: knownScript('secp256k1Blake160', ALICE), type: xudtType, data: u128le(500_000000n) }),
    cell({ capacity: ckb('15.999'), lock: knownScript('secp256k1Blake160', ALICE) }),
  ],
  cellDeps: [SECP_DEP_GROUP, XUDT_DEP],
  headerDeps: [],
  witnesses: [SIG_WITNESS],
})

// ─── 3. Nervos DAO deposit ────────────────────────────────────────────────
const DAO_HASH = '0x5d1e3a7c9b2f4d6a8c0e2b4d6f8a0c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a'
const DAO_DEPOSIT_DATA = '0x0000000000000000' // 8 bytes zero -> a fresh deposit

const daoDeposit = tx({
  hash: DAO_HASH,
  blockNumber: 13_479_001n,
  timestamp: Date.parse('2026-07-09T22:41:00Z'),
  fee: ckb('0.001'),
  size: 903,
  cyclesConsumed: 2_044_120n,
  inputs: [
    input(
      { txHash: h('7a0c1e', '3b5d7f'), index: 0 },
      cell({ capacity: ckb('20512.4'), lock: knownScript('secp256k1Blake160', DAO_ADMIN) }),
    ),
  ],
  outputs: [
    cell({
      capacity: ckb('20000'),
      lock: knownScript('secp256k1Blake160', DAO_ADMIN),
      type: knownScript('nervosDao', '0x'),
      data: DAO_DEPOSIT_DATA,
    }),
    cell({ capacity: ckb('512.399'), lock: knownScript('secp256k1Blake160', DAO_ADMIN) }),
  ],
  cellDeps: [SECP_DEP_GROUP, DAO_DEP],
  headerDeps: [h('d30c0f', 'a1b2c3')],
  witnesses: [SIG_WITNESS],
})

// ─── 4. Batch payout (many outputs -> grouping) ───────────────────────────
const BATCH_HASH = h('cc11aa', '55f0e1')
const batchRecipients = [BOB, CAROL, ALICE, args20('e'), args20('f'), args20('1'), args20('2'), args20('3'), args20('4'), args20('5'), args20('6'), args20('7')]

const batchPayout = tx({
  hash: BATCH_HASH,
  blockNumber: 13_488_300n,
  timestamp: Date.parse('2026-07-10T06:30:00Z'),
  fee: ckb('0.004'),
  size: 3_180,
  cyclesConsumed: 5_120_880n,
  inputs: [
    input(
      { txHash: h('0f1e2d', '9c8b7a'), index: 0 },
      cell({ capacity: ckb('12500'), lock: knownScript('secp256k1Blake160', DAO_ADMIN) }),
    ),
  ],
  outputs: batchRecipients.map((a, i) =>
    cell({ capacity: ckb(i === batchRecipients.length - 1 ? '1499.996' : '1000'), lock: knownScript('secp256k1Blake160', a) }),
  ),
  cellDeps: [SECP_DEP_GROUP],
  headerDeps: [],
  witnesses: [SIG_WITNESS],
})

// ─── 5. Unrecognized script ───────────────────────────────────────────────
const UNKNOWN_HASH = h('f00dfe', 'ed0042')
const unknownLock: Script = {
  codeHash: '0x' + 'deadbeef'.repeat(8),
  hashType: 'data1',
  args: args20('9'),
}

const unrecognized = tx({
  hash: UNKNOWN_HASH,
  blockNumber: 13_490_450n,
  timestamp: Date.parse('2026-07-10T11:02:00Z'),
  fee: ckb('0.002'),
  size: 1_640,
  inputs: [
    input(
      { txHash: h('ab12cd', '34ef56'), index: 0 },
      cell({ capacity: ckb('8000'), lock: unknownLock, data: '0x1f8b0800a1b2c3' }),
    ),
  ],
  outputs: [
    cell({ capacity: ckb('7999.998'), lock: unknownLock, data: '0x2c4e6a' }),
  ],
  cellDeps: [{ outPoint: { txHash: h('beef01', 'cafe02'), index: 0 }, depType: 'code' }],
  headerDeps: [],
  witnesses: ['0x' + '00'.repeat(97)],
})

// ─── Assembly ─────────────────────────────────────────────────────────────

export const EXAMPLES: BundledExample[] = [
  { id: 'ckb-transfer', label: 'CKB transfer', transaction: ckbTransfer },
  { id: 'xudt', label: 'Token (xUDT)', transaction: xudtTransfer },
  { id: 'nervos-dao', label: 'Nervos DAO', transaction: daoDeposit },
  { id: 'batch-payout', label: 'Batch payout', transaction: batchPayout },
  { id: 'unrecognized', label: 'Unrecognized', transaction: unrecognized },
]

/** Extra transactions reachable only by lineage (not in the examples menu). */
export const LINKED_TRANSACTIONS: Transaction[] = [parentTx, childTx]

/** Forward-lineage links: "outpoint key" -> the hash of the consuming tx. */
export const CONSUMERS: Record<string, string> = {
  [`${PARENT_HASH}:1`]: CKB_TRANSFER_HASH,
  [`${CKB_TRANSFER_HASH}:0`]: CHILD_HASH,
}

export const DEFAULT_EXAMPLE: ExampleCategory = 'ckb-transfer'
