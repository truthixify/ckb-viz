/**
 * The normalized transaction model (SPEC §5). Every source — a node, an
 * indexer, or the explorer API — is normalized into these shapes before
 * anything renders. Amounts are held as `bigint` counts of shannons and
 * formatted to CKB only at the render edge (1 CKB = 10^8 shannons).
 *
 * Enrichment fields (`known`, `decoded`, `resolved`) are optional: the source
 * produces raw-normalized data; the registry and decoder fill them in.
 */

export type Network = 'mainnet' | 'testnet'

/** hash_type selects how a script's code cell is located. */
export type HashType = 'data' | 'type' | 'data1' | 'data2'

/** tx_status from the node. Only `committed` guarantees on-chain inclusion. */
export type TxStatus = 'pending' | 'proposed' | 'committed' | 'unknown' | 'rejected'

export type DepType = 'code' | 'depGroup'

export type ScriptCategory = 'lock' | 'type'

/** A reference to a cell by transaction hash and output index. */
export interface OutPoint {
  txHash: string
  index: number
}

/** A registry match: what a recognized script is and does. */
export interface KnownScript {
  /** Full decoded name for the detail panel, e.g. "Secp256k1 / Blake160". */
  name: string
  /** Short tag label that fits on a cell, e.g. "Secp256k1". */
  shortName: string
  category: ScriptCategory
  /** One-line plain-language explanation of what the script does. */
  meaning: string
  docsUrl?: string
}

export interface Script {
  codeHash: string
  hashType: HashType
  /** hex, "0x…" */
  args: string
  /** blake2b script hash; computed during enrichment, used for token identity. */
  hash?: string
  /** The ckb2021 address for a lock script (bech32m), when computed. */
  address?: string
  /** Registry match, absent when the script is unrecognized. */
  known?: KnownScript
}

export type DecodedDataKind =
  | 'empty'
  | 'udt'
  | 'dao-deposit'
  | 'dao-withdraw'
  | 'spore'
  | 'cluster'
  | 'raw'

/** The decoder's reading of a cell's data. Always best-effort and labeled. */
export interface DecodedData {
  kind: DecodedDataKind
  /** Human reading, e.g. "1,500 USDC" or "DAO deposit". */
  label?: string
  /** True when the reading is inferred rather than read verbatim from the chain. */
  inferred: boolean
  /** UDT amount as a raw integer (before applying decimals). */
  udtAmount?: bigint
  /** Token symbol where resolvable. */
  udtSymbol?: string
  udtDecimals?: number
  /** DAO withdrawing cell: the deposit block height. */
  daoDepositBlock?: bigint
  /** Spore/Cluster metadata. */
  contentType?: string
  contentByteLength?: number
  clusterId?: string
  clusterName?: string
  /** A data: URI for a renderable inline Spore image. */
  imageDataUri?: string
  /** An https link when Spore content references off-chain data (IPFS / URL). */
  externalUrl?: string
}

export interface Cell {
  /** Total capacity in shannons. */
  capacity: bigint
  /** Bytes actually occupied by the cell (as capacity), vs the total. */
  occupiedCapacity: bigint
  lock: Script
  type?: Script
  /** Raw output data, hex "0x…" ("0x" when empty). */
  data: string
  /** Decoder reading of the data, filled during enrichment. */
  decoded?: DecodedData
  /** Where this cell lives on-chain (outputs carry {txHash, index}). */
  outPoint?: OutPoint
}

/** A decoded `since` timelock on an input. */
export interface DecodedSince {
  raw: bigint
  /** False when since == 0 (no timelock). */
  isSet: boolean
  relative: boolean
  metric: 'block' | 'epoch' | 'timestamp' | 'invalid'
  value: bigint
  /** Rendered string, e.g. "no timelock", "relative epoch 0 + 900/1800". */
  label: string
}

export interface Input {
  outPoint: OutPoint
  since: DecodedSince
  /** The resolved previous cell, when it could be fetched. */
  cell?: Cell
}

export interface CellDep {
  outPoint: OutPoint
  depType: DepType
  /** The referenced script's identity, when known. */
  resolved?: KnownScript
}

export interface Transaction {
  hash: string
  network: Network
  status: TxStatus
  blockNumber?: bigint
  /** Milliseconds since epoch, from the including block's header. */
  timestamp?: number
  /** fee = Σ inputs.capacity − Σ outputs.capacity, shannons. Undefined when
   *  inputs are unresolved. For a Nervos DAO withdrawal, adjusted to the real
   *  fee by adding back the compensation. */
  fee?: bigint
  /** Nervos DAO compensation (interest) released by a withdrawal, shannons. */
  daoCompensation?: bigint
  /** Serialized size in bytes. */
  size: number
  cyclesConsumed?: bigint
  inputs: Input[]
  outputs: Cell[]
  cellDeps: CellDep[]
  headerDeps: string[]
  witnesses: string[]
}

/** Capacity sums used by the summary banner and the flow totals. */
export interface CapacityBreakdown {
  inputsTotal: bigint | undefined
  outputsTotal: bigint
  fee: bigint | undefined
  daoCompensation?: bigint
}
