import type { CellDep, KnownScript, Network, Script } from '@/domain/types'
import { truncateHash } from '@/domain/units'
import { deploymentFor, type KnownScriptId } from './codeHashes'
import { KNOWN_DEPS } from './deps'
import { SCRIPT_META } from './seed'

/**
 * The script registry (SPEC §7). Keyed per network by (code_hash, hash_type),
 * because code hashes differ across mainnet and testnet. Lookup is O(1). An
 * unrecognized script is never guessed — it is returned unannotated and the UI
 * shows a shortened code hash marked unrecognized.
 */

function key(codeHash: string, hashType: string): string {
  return `${codeHash.toLowerCase()}:${hashType}`
}

interface RegistryEntry extends KnownScript {
  id: KnownScriptId
}

function buildTable(network: Network): Map<string, RegistryEntry> {
  const table = new Map<string, RegistryEntry>()
  for (const id of Object.keys(SCRIPT_META) as KnownScriptId[]) {
    const deployment = deploymentFor(id, network)
    if (!deployment) continue
    const meta = SCRIPT_META[id]
    const entry: RegistryEntry = { id, ...meta }
    table.set(key(deployment.codeHash, deployment.hashType), entry)
  }
  return table
}

const depKey = (txHash: string, index: number, depType: string) =>
  `${txHash.toLowerCase()}:${index}:${depType}`

function buildDepTable(network: Network): Map<string, KnownScript> {
  const table = new Map<string, KnownScript>()
  for (const dep of KNOWN_DEPS[network]) {
    table.set(depKey(dep.outPoint.txHash, dep.outPoint.index, dep.depType), SCRIPT_META[dep.scriptId])
  }
  return table
}

export class ScriptRegistry {
  readonly network: Network
  private readonly table: Map<string, RegistryEntry>
  private readonly depTable: Map<string, KnownScript>

  constructor(network: Network) {
    this.network = network
    this.table = buildTable(network)
    this.depTable = buildDepTable(network)
  }

  /** Look up a script's identity, or undefined when unrecognized. */
  lookup(script: Pick<Script, 'codeHash' | 'hashType'>): RegistryEntry | undefined {
    return this.table.get(key(script.codeHash, script.hashType))
  }

  /** The registry id for a script, or undefined — used by the decoder. */
  identify(script: Pick<Script, 'codeHash' | 'hashType'>): KnownScriptId | undefined {
    return this.lookup(script)?.id
  }

  /** Return a copy of the script with `known` set when recognized. */
  annotate(script: Script): Script {
    const entry = this.lookup(script)
    if (!entry) return script
    const { id: _id, ...known } = entry
    return { ...script, known }
  }

  /** Resolve a cell dep to a known script by its out-point, when known. */
  resolveDep(dep: CellDep): KnownScript | undefined {
    return this.depTable.get(depKey(dep.outPoint.txHash, dep.outPoint.index, dep.depType))
  }
}

/** The label for an unrecognized script: a shortened code hash, never a guess. */
export function unknownScriptLabel(script: Pick<Script, 'codeHash'>): string {
  return truncateHash(script.codeHash, 6, 6)
}
