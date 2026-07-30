import type { Cell, Script, Transaction } from './types'

/**
 * Net-change view of a transaction (SPEC §9.9): who gained and who lost, rather
 * than a cell-by-cell flow. A 263-output payout reads as one payer and N
 * recipients instead of hundreds of cards. Owners are grouped by their lock
 * script (one party = one lock); amounts are held as signed `bigint` shannons
 * and raw token counts, formatted only at the render edge.
 *
 * The net is exact only when every input cell is resolved. On a large,
 * partially-sampled transaction the input side is unknown, so `complete` is
 * false and the caller shows the received side without claiming a true net.
 */

export interface NetTokenChange {
  /** Stable token identity: the type script's (code_hash, hash_type, args). */
  key: string
  type: Script
  symbol?: string
  decimals?: number
  /** Signed net raw amount: Σ outputs − Σ inputs for this owner and token. */
  amount: bigint
}

/** A cell belonging to an owner, kept so the view can drill in to it. */
export interface OwnerCellRef {
  side: 'input' | 'output'
  index: number
  cell: Cell
}

export interface OwnerNetChange {
  /** Stable owner identity: the lock's (code_hash, hash_type, args). */
  key: string
  lock: Script
  /** The lock's ckb2021 address, when it could be encoded. */
  address?: string
  /** Capacity this owner contributed (from resolved inputs), shannons. */
  inCapacity: bigint
  /** Capacity this owner received (into outputs), shannons. */
  outCapacity: bigint
  /** Signed net CKB: outCapacity − inCapacity, shannons. */
  netCkb: bigint
  /** Signed net token changes, non-zero movements only. */
  tokens: NetTokenChange[]
  inputCells: number
  outputCells: number
  /** The cells this owner spent and received, in transaction order. */
  members: OwnerCellRef[]
  /** True when this owner is on both sides (change / consolidation). */
  isChange: boolean
}

export interface NetChange {
  owners: OwnerNetChange[]
  /** True when every input cell was resolved, so the net is exact. */
  complete: boolean
}

function scriptKey(s: Script): string {
  return `${s.codeHash.toLowerCase()}:${s.hashType}:${s.args.toLowerCase()}`
}

/**
 * Fold a transaction into per-owner net changes. Inputs count against their
 * owner (spent), outputs count toward theirs (received). Owners are ordered by
 * the size of their CKB movement, biggest movers first, so a reader sees the
 * payer and the largest recipients at the top.
 */
export function computeNetChange(tx: Transaction): NetChange {
  const complete = tx.inputs.length === 0 || tx.inputs.every((i) => i.cell)
  const owners = new Map<string, OwnerNetChange>()

  const ownerFor = (lock: Script): OwnerNetChange => {
    const key = scriptKey(lock)
    let owner = owners.get(key)
    if (!owner) {
      owner = {
        key,
        lock,
        inCapacity: 0n,
        outCapacity: 0n,
        netCkb: 0n,
        tokens: [],
        inputCells: 0,
        outputCells: 0,
        members: [],
        isChange: false,
        ...(lock.address ? { address: lock.address } : {}),
      }
      owners.set(key, owner)
    }
    return owner
  }

  const applyToken = (owner: OwnerNetChange, cell: Cell, sign: bigint): void => {
    const decoded = cell.decoded
    if (!cell.type || decoded?.kind !== 'udt' || decoded.udtAmount === undefined) return
    const key = scriptKey(cell.type)
    let token = owner.tokens.find((t) => t.key === key)
    if (!token) {
      token = {
        key,
        type: cell.type,
        amount: 0n,
        ...(decoded.udtSymbol ? { symbol: decoded.udtSymbol } : {}),
        ...(decoded.udtDecimals !== undefined ? { decimals: decoded.udtDecimals } : {}),
      }
      owner.tokens.push(token)
    }
    token.amount += sign * decoded.udtAmount
  }

  tx.inputs.forEach((input, index) => {
    const cell = input.cell
    if (!cell) return
    const owner = ownerFor(cell.lock)
    owner.inCapacity += cell.capacity
    owner.inputCells += 1
    owner.members.push({ side: 'input', index, cell })
    applyToken(owner, cell, -1n)
  })

  tx.outputs.forEach((cell, index) => {
    const owner = ownerFor(cell.lock)
    owner.outCapacity += cell.capacity
    owner.outputCells += 1
    owner.members.push({ side: 'output', index, cell })
    applyToken(owner, cell, 1n)
  })

  const list = [...owners.values()]
  for (const owner of list) {
    owner.netCkb = owner.outCapacity - owner.inCapacity
    owner.tokens = owner.tokens.filter((t) => t.amount !== 0n)
    owner.isChange = owner.inputCells > 0 && owner.outputCells > 0
  }

  list.sort((a, b) => {
    const byCkb = absCompare(b.netCkb, a.netCkb)
    if (byCkb !== 0) return byCkb
    return b.tokens.length - a.tokens.length
  })

  return { owners: list, complete }
}

function absCompare(a: bigint, b: bigint): number {
  const aa = a < 0n ? -a : a
  const bb = b < 0n ? -b : b
  return aa === bb ? 0 : aa > bb ? 1 : -1
}
