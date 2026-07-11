import type { Cell, Network, Script, Transaction } from '@/domain/types'
import { formatCkb, formatInt } from '@/domain/units'
import type { ScriptRegistry } from '@/registry/registry'
import { decodeDaoCell } from './dao'
import { lookupToken } from './tokens'
import { decodeUdtAmount, formatUdtAmount } from './udt'

/**
 * The transaction decoder (SPEC §8.2): a classification decision tree that
 * produces a one-sentence plain-language headline. Best-effort — the headline
 * is always inferred, never presented as ground truth the chain asserted. When
 * intent can't be inferred it describes the transaction structurally rather
 * than inventing meaning.
 */
export type DecodeKind =
  | 'ckb-transfer'
  | 'udt-transfer'
  | 'udt-mint'
  | 'dao-deposit'
  | 'dao-withdraw'
  | 'spore'
  | 'structural'

export interface DecodeResult {
  kind: DecodeKind
  headline: string
  inferred: boolean
  confidence: 'high' | 'medium' | 'low'
}

const lockKey = (s: Script) => `${s.codeHash}:${s.hashType}:${s.args}`.toLowerCase()

export function decodeTransaction(
  tx: Transaction,
  network: Network,
  registry: ScriptRegistry,
): DecodeResult {
  const outputs = tx.outputs
  const inputCells = tx.inputs.map((i) => i.cell).filter((c): c is Cell => Boolean(c))
  const identify = (s?: Script) => (s ? registry.identify(s) : undefined)
  const inputLocks = new Set(inputCells.map((c) => lockKey(c.lock)))
  const nonChangeOutputs = outputs.filter((o) => !inputLocks.has(lockKey(o.lock)))

  // Nervos DAO — distinctive, checked first.
  const daoDepositOut = outputs.filter(
    (o) => identify(o.type) === 'nervosDao' && decodeDaoCell(o.data)?.phase === 'deposit',
  )
  if (daoDepositOut.length > 0) {
    const amount = daoDepositOut.reduce((a, c) => a + c.capacity, 0n)
    return {
      kind: 'dao-deposit',
      headline: `A Nervos DAO deposit of ${formatCkb(amount)} CKB.`,
      inferred: true,
      confidence: 'high',
    }
  }
  if (inputCells.some((c) => identify(c.type) === 'nervosDao')) {
    return {
      kind: 'dao-withdraw',
      headline: 'A Nervos DAO withdrawal.',
      inferred: true,
      confidence: 'high',
    }
  }

  // Spore / Cluster.
  const sporeInOut = outputs.some((o) => ['spore', 'cluster'].includes(identify(o.type) ?? ''))
  const sporeIn = inputCells.some((c) => ['spore', 'cluster'].includes(identify(c.type) ?? ''))
  if (sporeInOut || sporeIn) {
    const verb = sporeInOut && !sporeIn ? 'mint' : !sporeInOut && sporeIn ? 'melt' : 'transfer'
    return { kind: 'spore', headline: `A Spore ${verb}.`, inferred: true, confidence: 'medium' }
  }

  // UDT (sUDT / xUDT).
  const udtOutputs = outputs.filter((o) => ['sudt', 'xudt'].includes(identify(o.type) ?? ''))
  if (udtOutputs.length > 0) {
    const token = udtOutputs[0]?.type ? lookupToken(network, udtOutputs[0].type) : undefined
    const sumUdt = (cells: Cell[]) =>
      cells.reduce((a, c) => a + (decodeUdtAmount(c.data) ?? 0n), 0n)
    const inUdt = sumUdt(inputCells.filter((c) => ['sudt', 'xudt'].includes(identify(c.type) ?? '')))
    const movedRaw = sumUdt(udtOutputs.filter((o) => !inputLocks.has(lockKey(o.lock))))
    const moved = movedRaw > 0n ? movedRaw : sumUdt(udtOutputs)
    const amountText = token ? `${formatUdtAmount(moved, token.decimals)} ${token.symbol}` : `${formatInt(moved)} units`
    const minting = inUdt === 0n
    return {
      kind: minting ? 'udt-mint' : 'udt-transfer',
      headline: minting ? `A token mint of ${amountText}.` : `A token transfer of ${amountText}.`,
      inferred: true,
      confidence: token ? 'high' : 'medium',
    }
  }

  // Plain CKB transfer — no type scripts anywhere.
  const anyType = outputs.some((o) => o.type) || inputCells.some((c) => c.type)
  if (!anyType) {
    const moved = nonChangeOutputs.reduce((a, c) => a + c.capacity, 0n)
    if (nonChangeOutputs.length > 0) {
      return {
        kind: 'ckb-transfer',
        headline: `A CKB transfer of ${formatCkb(moved)} CKB.`,
        inferred: true,
        confidence: 'high',
      }
    }
    const total = outputs.reduce((a, c) => a + c.capacity, 0n)
    return {
      kind: 'ckb-transfer',
      headline: `A CKB transaction moving ${formatCkb(total)} CKB.`,
      inferred: true,
      confidence: 'medium',
    }
  }

  // Structural fallback — name the dominant script, invent no intent.
  const dominant = dominantScriptName(outputs, registry)
  return {
    kind: 'structural',
    headline: `${formatInt(tx.inputs.length)} input${tx.inputs.length === 1 ? '' : 's'} → ${formatInt(outputs.length)} output${outputs.length === 1 ? '' : 's'}${dominant ? `, ${dominant}` : ''}.`,
    inferred: false,
    confidence: 'low',
  }
}

function dominantScriptName(cells: Cell[], registry: ScriptRegistry): string | undefined {
  const counts = new Map<string, number>()
  for (const c of cells) {
    const known = c.type ? registry.lookup(c.type) : registry.lookup(c.lock)
    if (known) counts.set(known.shortName, (counts.get(known.shortName) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}
