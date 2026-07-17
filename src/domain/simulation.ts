import type { Transaction } from './types'

/**
 * The result of simulating a transaction against current chain state (SPEC:
 * CKB has no on-chain failed transactions, so "would this be valid?" is
 * answered by running it, not by looking it up). A valid tx reports the cycles
 * its scripts consumed; an invalid one reports why, with the failing script
 * group and exit code pulled out of the node's error where present.
 */
export interface SimulationResult {
  verdict: 'valid' | 'invalid'
  /** Cycles consumed by the scripts (valid only). */
  cycles?: bigint
  /** fee = Σ inputs − Σ outputs, when inputs resolved. */
  fee?: bigint
  error?: SimulationError
  /** The normalized transaction, for rendering the flow. */
  transaction: Transaction
}

export type SimulationErrorKind = 'resolve' | 'script' | 'capacity' | 'pool' | 'malformed' | 'other'

export interface SimulationError {
  kind: SimulationErrorKind
  /** A plain-language one-liner. */
  headline: string
  /** The node's raw error message, verbatim. */
  raw: string
  /** The failing script group, e.g. "Inputs[0].Lock", when present. */
  scriptGroup?: string
  /** The script's 8-bit exit code, when present. */
  exitCode?: number
  /** The out-point that could not be resolved, for a resolve failure. */
  outPoint?: string
  /** The transaction that already spent the unresolved input, when found —
   *  usually this transaction, now committed on-chain. */
  consumedBy?: string
}

/**
 * Parse a node error (from estimate_cycles / test_tx_pool_accept) into a
 * structured, human verdict. Defensive: unknown shapes fall back to the raw
 * message so nothing is hidden.
 */
/** Split a CKB error's OutPoint blob (0x + txHash[32] + index[4 LE]) into its
 *  transaction hash and output index, so the consumer can be looked up. */
export function splitOutPoint(blob: string): { txHash: string; index: number } | null {
  const hex = blob.replace(/^0x/, '')
  if (hex.length < 64) return null
  const idxHex = hex.slice(64, 72)
  const le = (idxHex.match(/../g) ?? []).reverse().join('')
  return { txHash: '0x' + hex.slice(0, 64), index: le ? Number(BigInt('0x' + le)) : 0 }
}

export function parseSimulationError(raw: string): SimulationError {
  const scriptGroup = raw.match(/(Inputs|Outputs)\[(\d+)\]\.(Lock|Type)/)?.[0]
  const exitMatch =
    raw.match(/exit\s*code\s*(-?\d+)/i) ??
    raw.match(/error\s*code\s*(-?\d+)/i) ??
    raw.match(/ExitCode\((-?\d+)\)/i) ??
    raw.match(/code:?\s*(-?\d+)/i)
  const exitCode = exitMatch ? Number(exitMatch[1]) : undefined
  const outPoint = raw.match(/OutPoint\((0x[0-9a-fA-F]+)\)/)?.[1]

  if (/FailedToResolve|Unknown\(OutPoint|Dead\(OutPoint|resolve/i.test(raw)) {
    return {
      kind: 'resolve',
      headline: 'An input cell could not be resolved — it may be already spent, or not yet on-chain.',
      raw,
      ...(outPoint ? { outPoint } : {}),
    }
  }
  if (/ScriptError|ValidationFailure|VM|exit\s*code|error\s*code|ExitCode/i.test(raw)) {
    const where = scriptGroup ? ` in ${scriptGroup}` : ''
    const code = exitCode !== undefined ? ` (exit code ${exitCode})` : ''
    return {
      kind: 'script',
      headline: `A script failed${where}${code}.`,
      raw,
      ...(scriptGroup ? { scriptGroup } : {}),
      ...(exitCode !== undefined ? { exitCode } : {}),
    }
  }
  if (/Capacity|InsufficientCapacity|CapacityOverflow/i.test(raw)) {
    return { kind: 'capacity', headline: 'A capacity rule was violated (outputs exceed inputs, or a cell is below its minimum).', raw }
  }
  if (/Duplicated|already exists|PoolReject|RBF|Full/i.test(raw)) {
    return { kind: 'pool', headline: 'The transaction pool rejected it (duplicate, replacement, or pool full) — its scripts may still be valid.', raw }
  }
  return { kind: 'other', headline: 'The node rejected the transaction.', raw }
}
