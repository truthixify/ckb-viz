# ckb-viz — CKB Transaction Visualizer Specification

**Status:** Draft v2

**ckb-viz** is a read-only, browser-based tool that resolves any Nervos CKB transaction by hash and renders it as a legible flow of cells — inputs on the left, outputs on the right, connectors between the cells a transaction consumes and creates. It reads directly from a public CKB JSON-RPC node (which bundles the indexer and serves permissive CORS), decodes the cell model down to script-level detail — capacities, lock and type scripts, witnesses, `since` locks, and well-known asset payloads (sUDT/xUDT, Nervos DAO, Spore/DOB) — labels known scripts by name, and traces lineage backward (where each input came from) and, where an index permits, forward (where each output was spent). No wallet, no signing, no writes.

## Table of contents

1. Overview
2. Goals
3. Non-goals
4. Terminology
5. Data model
6. Data sources and the source adapter
7. Script registry
8. Transaction decoder
9. Surfaces and UX
10. Design system
11. Architecture and tech stack
12. Component inventory
13. Non-functional requirements
14. Delivery phases and acceptance criteria
15. Open questions resolved
16. Appendices

## 1. Overview

CKB is a UTXO-style chain built on the *cell model*. There are no accounts and no mutable contract storage: state lives in immutable **cells**, each carrying a capacity, a lock script, an optional type script, and an arbitrary data blob. A transaction is a pure state transition — it consumes a set of existing cells (its inputs) and produces a new set (its outputs), and the scripts on those cells decide whether the transition is valid. This is elegant but hard to read. A raw transaction returned by a node is a wall of `0x`-prefixed hex: capacities in shannons, 32-byte code hashes, molecule-serialized witnesses, packed `since` values. Nothing about it announces "Alice sent 100 CKB and 5,000 USDC to Bob and got change back."

ckb-viz closes that gap. Given a transaction hash (or a `tx_hash:index` OutPoint, or a full address), it fetches the transaction and every cell it touches, decodes each cell to the level a competent CKB engineer would want, and lays the whole thing out as a flow diagram: a left column of input cells, a right column of output cells, cell deps and header deps grouped above, witnesses grouped below, and hairline connectors linking related cells. Hovering a cell highlights its connections and its lineage; expanding a cell reveals its lock, its type, its decoded data, and — for recognized assets — a human reading such as a token balance, a DAO deposit, or a Spore digital object.

The tool is deliberately **read-only and self-contained on the client**. Every read hits a public CKB JSON-RPC endpoint (default `https://mainnet.ckb.dev/` and `https://testnet.ckb.dev/`), which returns `access-control-allow-origin: *` and exposes both the chain methods (`get_transaction`, `get_live_cell`, `get_header`) and the node's built-in indexer methods (`get_cells`, `get_transactions`) on the same URL. No backend, no proxy, and no signing key are required for the core experience. A user may paste their own node URL. The one capability the node RPC cannot provide unaided — forward lineage, i.e. *which transaction spent this output* — is handled as a distinct, clearly-labeled data plane (§6), because the node exposes no reverse index from an OutPoint to its consumer.

The intended audience is developers, auditors, and power users who already understand — or want to understand — the cell model: people debugging a failed script, tracing an asset's provenance, or simply learning how a particular protocol lays out its cells. The design goal throughout is *fidelity without noise*: show exactly what is on-chain, decode it correctly, name what is nameable, and never invent meaning the chain does not carry.

## 2. Goals

- **Resolve any transaction by hash.** Accept a 32-byte `tx_hash` and render its full structure at verbosity `2` — version, cell deps, header deps, inputs, outputs, `outputs_data`, witnesses, and `tx_status` (pending / proposed / committed / unknown / rejected) — with pool metadata (`cycles`, `fee`, `min_replace_fee`, `time_added_to_pool`) shown when present and treated as nullable.
- **Render the cell flow visually.** Lay inputs and outputs as two columns of styled cell cards with connectors drawn between related cells, so the shape of the state transition is legible at a glance. Hovering a cell highlights its connectors and dims the rest; expanding a cell reveals its full decoded detail.
- **Decode to script-level fidelity.** For every cell, show `capacity` (in both shannons and CKB, `1 CKB = 10^8 shannons`), the lock script, the optional type script, and the raw data — each field labeled, hex preserved, and the underlying molecule structure respected.
- **Decode `since`, witnesses, and dep types correctly.** Split each `since` into its flag byte and 56-bit value and render it as absolute/relative block-number / epoch (`E + I/L`) / median-timestamp. Parse each witness as `WitnessArgs` (`lock`, `input_type`, `output_type`) where it applies. Distinguish `code` vs `dep_group` cell deps and, for a dep group, expand its member OutPoints.
- **Name known scripts.** Match each lock/type script by `(code_hash, hash_type)` against a per-network registry and label it (e.g. `Secp256k1Blake160`, `OmniLock`, `xUDT`, `NervosDao`, `Spore`), rather than showing a bare hash.
- **Decode well-known asset payloads.** Recognize and render sUDT/xUDT balances (leading 16-byte LE `u128` amount), Nervos DAO deposit vs. withdrawing cells (8-byte LE `u64` data), and Spore/Cluster metadata (`SporeData` / `ClusterData` molecule), with a graceful fallback to raw hex for anything unrecognized.
- **Trace lineage both directions.** Resolve each input backward to its source cell (`O(1)` via `get_transaction` / `get_live_cell`). Where an index is available, trace each output forward to its consuming transaction, presented as a separate, clearly-attributed capability (§6).
- **Support both networks.** Detect and switch between mainnet (`ckb`) and testnet (`ckt`), using the correct per-network endpoints, script registry, and address HRP.
- **Render addresses.** Encode any lock script as a ckb2021 full address (bech32m of `0x00 | code_hash | hash_type | args`) and accept an address or OutPoint as an entry point.
- **Run entirely in the browser.** No mandatory backend for the core read path; direct RPC calls to a CORS-permissive public node, with a user-overridable node URL.

## 3. Non-goals

- **No wallet, signing, or transaction construction.** The tool never holds keys, never builds a transaction, and never broadcasts. It is a viewer, not a wallet.
- **No block explorer.** It does not offer address balance pages, rich-lists, block browsing, search over arbitrary metadata, or historical charts. It resolves *a transaction* (or a cell, or an address's transactions) and shows *that*.
- **No trustless forward index of its own.** The tool does not run or replicate an indexer that maps every OutPoint to its spender. Forward lineage relies on the node's built-in indexer (script-keyed) or an external explorer API; where neither is available, "consumed by" is honestly shown as unknown.
- **No on-chain DOB/DNA rendering pipeline.** For Spore digital objects the tool decodes the `SporeData` molecule (content type, content, cluster id) and may embed self-contained media, but it does not reimplement the DOB/0 and DOB/1 trait-decoding pipeline (DNA + cluster pattern + decoder binary); that is delegated or shown as raw content.
- **No write path, no mempool participation, no fee estimation for sending.** Pool metadata is displayed as read from the node, not computed for the purpose of submitting anything.
- **No account abstraction over the cell model.** The tool shows cells as cells. It does not collapse a transaction into an "account balance changed by X" abstraction beyond the asset-level decoding described above.

## 4. Terminology

The definitions below are the working vocabulary for the rest of this document. Field names use JSON-RPC casing (`snake_case`); the molecule schema occasionally differs (noted where it matters, e.g. `type_` vs `type`).

| Term | Definition |
|---|---|
| **Cell** | The fundamental unit of state on CKB. Exactly four fields: `capacity` (a `uint64` of shannons), `lock` (a required `Script`), `type` (an optional `Script`), and `data` (an arbitrary byte string). The data is not stored inside the cell output on the wire — it lives in the transaction's parallel `outputs_data` array at the same index. Cells are immutable; they are created and consumed, never mutated. |
| **Capacity** | The size budget of a cell, measured in shannons and stored in the `capacity` field. It is simultaneously the cell's CKB value and its byte allowance: owning `1 CKByte` entitles the holder to store `1` byte of on-chain state. A cell's occupied bytes must not exceed its capacity. |
| **Shannon** | The smallest unit of the native token. `1 CKB (CKByte) = 100,000,000 shannons = 10^8 shannons`. All capacities, fees, and amounts on the wire are counts of shannons, serialized as `0x`-prefixed hex; divide by `10^8` for CKB display. |
| **Occupied capacity** | The minimum capacity a cell must carry to be valid, in bytes, equal to the raw sum `len(capacity) + len(data) + len(lock) + len(type)` — that is, `8` (capacity) `+ len(data) + (32 + 1 + len(args))` per present script, with an absent type contributing `0`. It counts raw field bytes only, **not** molecule table headers or offsets. A default secp256k1 cell with no type and no data occupies `8 + 32 + 1 + 20 = 61` bytes, hence the well-known `61 CKB` minimum. |
| **OutPoint** | A pointer that uniquely identifies a cell as the `index`-th output of a given transaction: `{ tx_hash: Byte32, index: Uint32 }`. Serialized as a molecule `struct` (`36` bytes flat). It is the only handle by which a cell is referenced. |
| **Input** | A cell being consumed, represented by `CellInput { since: Uint64, previous_output: OutPoint }` (molecule field order is `since` first). The input itself carries no capacity, lock, or data — those belong to the cell the `previous_output` points at, which must be resolved separately. |
| **Output** | A newly created cell, represented by `CellOutput { capacity, lock, type }`. Each output is paired by index with an entry in the transaction's `outputs_data`; the two arrays are always equal length. |
| **Lock script** | The required `Script` on a cell that governs ownership — it decides who may consume the cell, analogous to Bitcoin's `scriptPubKey`. To spend a cell you must satisfy its lock (typically by providing a signature in the corresponding witness). |
| **Type script** | The optional `Script` on a cell that constrains how the cell's data may change between the consumed and created states. It is the mechanism behind tokens, NFTs, and other stateful assets: e.g. a UDT's type script enforces conservation of the token amount. |
| **hash_type** | A `Script` field selecting how `code_hash` is matched against dep cells, and (for the `data*` variants) which CKB-VM version runs. JSON values: `"data"` (matches a dep cell's data hash, VM v0), `"type"` (matches a dep cell's *type-script* hash, enabling in-place upgrade), `"data1"` (data hash, VM v1), `"data2"` (data hash, VM v2). Enum discriminants `Data=0, Type=1, Data1=2, Data2=4`. |
| **Cell dep** | A read-only dependency a transaction declares so scripts and data are available at execution: `CellDep { out_point: OutPoint, dep_type }`. `dep_type` is `"code"` (the dep cell is used directly) or `"dep_group"` (see below). This is how a transaction references the script binaries its cells' locks/types run. |
| **Dep group** | A cell dep with `dep_type = "dep_group"` whose data is a molecule `Vec<OutPoint>`; the node loads the group cell, reads that list, and treats it as if every member OutPoint had been declared individually. It lets one `CellDep` pull in a multi-cell system script (e.g. the secp256k1 sighash code cell plus its precomputed data cell). |
| **Header dep** | A block header the transaction's scripts are permitted to read, declared as a bare `Byte32` block hash in the `header_deps` array. Used by scripts that need block context — most notably Nervos DAO, which reads deposit/withdraw headers to compute compensation. |
| **Witness** | An entry in the transaction's `witnesses` array (a `BytesVec` of `0x`-hex blobs) supplied by the transaction's creator to satisfy scripts — canonically the lock's signature. Witnesses are **excluded** from the transaction hash but are bound into the message the lock signs. The `witnesses` array is indexed independently of `inputs`. |
| **WitnessArgs** | The standard structure a witness blob usually deserializes to: `WitnessArgs { lock: BytesOpt, input_type: BytesOpt, output_type: BytesOpt }` (molecule table). By convention the lock signature goes in `lock`; `input_type` / `output_type` carry data for input/output type scripts. A witness may also be an arbitrary byte string when a script does not use this layout. |
| **Since** | A `uint64` timelock on each input (`CellInput.since`) preventing the transaction from being mined too early. The high `8` bits are flags — bit 63 = absolute(`0`)/relative(`1`), bits 62–61 = metric (`00` block number, `01` epoch, `10` median timestamp), bits 60–56 reserved — and the low `56` bits are the value. `since = 0` disables the check. For the epoch metric the value packs epoch number `E` (bits 0–23), index `I` (24–39), and length `L` (40–55), rendered as `E + I/L`. |
| **Molecule** | CKB's canonical serialization format. Fixed-size `struct` types are bare concatenations with no header; `table` types carry a `4`-byte little-endian total-size header plus a `4`-byte offset per field; `fixvec`/`dynvec` carry length/offset headers; all integers are little-endian. This is why on-wire size exceeds occupied capacity, which counts only raw field bytes. |
| **Known script** | A lock or type script whose `(code_hash, hash_type)` pair matches a curated per-network registry, so it can be labeled by name (e.g. `Secp256k1Blake160`, `OmniLock`, `xUDT`, `NervosDao`, `Spore`) instead of shown as a raw hash. All registry values are reference data to be re-verified against the live deployment; several scripts differ by network and even by `hash_type` (notably xUDT: `data1` on mainnet, `type` on testnet). |
| **Lineage** | The provenance chain of a cell. *Backward* lineage — the source cell an input came from — is `O(1)` via the input's `previous_output`. *Forward* lineage — the transaction that consumed an output — is not available from a bare node (no OutPoint→consumer index) and requires the script-keyed indexer or an external explorer API. |
| **Epoch** | CKB's unit of chain time above the block, used by difficulty adjustment, DAO compensation, and epoch-metric `since`. A packed epoch is `E + I/L` (epoch number, block index within the epoch, epoch length). Block headers expose `epoch` as a single packed `uint64` hex value. |
| **Network** | The chain a transaction belongs to. **Mainnet** (Lina) has chain id `ckb` and address HRP `ckb` (addresses begin `ckb1…`); **testnet** (Aggron/Testnet) has chain id `ckb_testnet` and HRP `ckt` (addresses begin `ckt1…`). Network is detected via `get_blockchain_info().chain` and selects the RPC endpoint, script registry, and address prefix. |
| **Address** | A human-facing encoding of a lock script per the ckb2021 (RFC0021) full format: bech32m over the payload `0x00 | code_hash(32) | hash_type(1) | args` (note the order — `code_hash` then `hash_type`), with HRP `ckb` (mainnet) or `ckt` (testnet). Any lock can be rendered as an address, and an address decodes back to a lock; legacy short/deprecated-full forms are parsed for older data. |

## 5. Data model

ckb-viz works against one normalized transaction shape regardless of source — node RPC, indexer, or explorer API all get normalized into this before anything renders. The raw CKB JSON-RPC shapes are snake_case with every integer as a `0x`-prefixed hex string; the normalized model is camelCase with every amount as a `bigint` count of shannons. Normalization is where hex is parsed, where the parallel `outputs`/`outputs_data` arrays are zipped into whole cells, and where input references are resolved into full cells so the rest of the app never touches the wire format.

All amounts — capacity, fee, occupied capacity, UDT balances — are held internally as `bigint` shannons and formatted to CKB only at the display edge, where `1 CKB = 1e8 shannon`. Never store a capacity as a float or a CKB-denominated number; the division happens in the formatter, nowhere else.

### 5.1 Core shapes

```typescript
interface Transaction {
  hash: string             // 0x + 64 hex, the tx hash (ckbhash of the raw tx, witnesses excluded)
  version: number          // tx version, currently always 0
  status: TxStatus         // "pending" | "proposed" | "committed" | "unknown" | "rejected"
  blockNumber?: bigint     // committed height; null unless status === "committed"
  blockHash?: string       // 0x + 64 hex of the committing block; null unless committed
  txIndex?: number         // index of this tx within its block; null unless committed
  timestamp?: bigint       // unix ms of the committing block; fetched separately via the header
  fee?: bigint             // shannons; from RPC when in-pool, else computed sum(in.cap) - sum(out.cap)
  size?: bigint            // serialized tx size in bytes, if the source provides it
  cyclesConsumed?: bigint  // VM execution cycles, if the source provides it
  inputs: Input[]          // cells consumed, in order
  outputs: Cell[]          // cells created, in order (zipped with outputsData at normalize time)
  cellDeps: CellDep[]      // cells read but not consumed (script code and its deps)
  headerDeps: string[]     // 0x + 64 hex block-header hashes the scripts may read
  witnesses: DecodedWitness[] // per-witness blobs, decoded to WitnessArgs where possible
  rejectReason?: string    // rejection message; present only when status === "rejected"
}

type TxStatus = "pending" | "proposed" | "committed" | "unknown" | "rejected"

interface Input {
  outPoint: OutPoint       // reference to the cell being consumed
  since: DecodedSince      // the since timelock, decoded (see 5.3); "no lock" when the raw value is 0
  cell?: Cell              // the resolved previous cell, if fetched (see 5.4); absent until resolved
  cellResolution: "live" | "consumed" | "unresolved" // how (or whether) cell was obtained
}

interface Cell {                 // a CKB cell = one transaction output
  capacity: bigint         // shannons; the cell's total capacity (also its byte budget)
  lock: Script             // required; guards who may consume the cell
  type?: Script            // optional; constrains how the cell is created/consumed (assets)
  data: string             // 0x + hex of the cell's raw data ("0x" when empty)
  decodedData?: DecodedData // best-effort interpretation of data (see 5.6)
  occupied: CapacityBreakdown // where the occupied bytes go, and the free surplus (see 5.5)
  outPoint?: OutPoint      // this cell's own outpoint; known for outputs (txHash + index), set at normalize
}

interface Script {
  codeHash: string         // 0x + 64 hex; identifies the script code (Byte32)
  hashType: HashType       // "data" | "type" | "data1" | "data2" — how codeHash is matched + VM version
  args: string             // 0x + hex; per-instance argument ("0x" when empty)
  hash: string             // 0x + 64 hex; ckbhash(molecule(script)) — the script hash used for identity/addressing
  known?: KnownScript       // registry match by (codeHash, hashType), if recognized (see 5.7)
}

type HashType = "data" | "type" | "data1" | "data2"

interface CellDep {
  outPoint: OutPoint       // the dependency cell
  depType: "code" | "depGroup" // "code" = use the cell directly; "depGroup" = cell data is a Vec<OutPoint> to expand
  known?: KnownScript       // the script this dep provides code for, if resolvable
}
```

A note on `status`: only `"committed"` guarantees on-chain inclusion, and only then are `blockNumber`, `blockHash`, `txIndex`, and (via a follow-up header fetch) `timestamp` populated. `"pending"`/`"proposed"` are in-pool states, `"unknown"` means the node has no record (or evicted it), and `"rejected"` carries a `rejectReason`. `fee`, `size`, and `cyclesConsumed` are all nullable at the source — treat them as optional and fall back to the computed fee (`sum(inputs.capacity) - sum(outputs.capacity)`, which requires every input cell to be resolved first).

### 5.2 OutPoint

```typescript
interface OutPoint {
  txHash: string           // 0x + 64 hex; the tx that created the referenced cell
  index: number            // the cell's position in that tx's outputs list (small, safe as number)
}
```

An `OutPoint` uniquely names a cell as the `index`-th output of `txHash`. It is the join key for backward lineage: an input's `outPoint.txHash` is the transaction to walk back to.

### 5.3 DecodedSince

`since` is a `uint64` (bit-packed) held raw and decoded for display. The top byte is flags: bit 63 is relative (`1`) vs absolute (`0`), bits 62–61 are the metric, and the low 56 bits are the value. A raw value of `0` disables the check.

```typescript
interface DecodedSince {
  raw: bigint              // the original uint64, kept for exactness
  isConfigured: boolean    // false when raw === 0n (no timelock)
  relative: boolean        // true = relative to the input cell's block, false = absolute
  metric: "block" | "epoch" | "timestamp" | "invalid" // bits 62-61: 00 | 01 | 10 | 11
  value: bigint            // for block: block number; for timestamp: unix seconds
  epoch?: DecodedEpoch     // populated only when metric === "epoch"
}

interface DecodedEpoch {   // epoch metric packs the 56-bit value as E + I/L
  number: bigint           // E, bits 0-23: the epoch number
  index: bigint            // I, bits 24-39: position within the epoch
  length: bigint           // L, bits 40-55: total blocks in the epoch
}                          // rendered value = number + index/length
```

Decode by masking `flags = (raw >> 56n) & 0xFFn` and `value = raw & 0x00FFFFFFFFFFFFFFn`, then branching on the metric. The `timestamp` metric is the median of the previous 37 blocks in seconds; `block` is a plain height; `epoch` uses the `E + I/L` fraction. `metric === "invalid"` (bits `11`) should be surfaced as malformed, not guessed.

### 5.4 Input cell resolution

An `Input` on the wire carries only `outPoint` and `since` — no capacity, lock, type, or data. To render an input as a real cell the normalizer resolves it, and `cellResolution` records how:

- Try `get_live_cell(outPoint, withData = true)` first. If `status === "live"`, use its `output` + `data` and set `cellResolution = "live"`.
- If the cell is not live (already spent — status comes back `"unknown"`, since `"dead"` is deprecated), fall back to `get_transaction(outPoint.txHash)` and read `outputs[outPoint.index]` + `outputs_data[outPoint.index]`; set `cellResolution = "consumed"`.
- If neither yields a cell, leave `cell` undefined and set `cellResolution = "unresolved"`; the input renders as a bare reference.

Backward resolution is always O(1) per input. Forward resolution (an output's consuming tx) is not available from a node at all and needs the indexer or explorer API — that is a §6 concern, not part of this normalized shape.

### 5.5 CapacityBreakdown

Occupied capacity is the sum of the raw field byte lengths — **not** the molecule-serialized size with table headers and offsets. Each occupied byte costs `1 CKB = 1e8 shannon`. This is what lets the UI show a cell's free surplus (capacity above what its contents require).

```typescript
interface CapacityBreakdown {
  capacityFieldBytes: bigint // always 8n (the Uint64 capacity field)
  lockBytes: bigint        // 32 (code_hash) + 1 (hash_type) + args byte length
  typeBytes: bigint        // 0n if no type; else 32 + 1 + args byte length
  dataBytes: bigint        // raw byte length of the cell's data
  occupiedBytes: bigint    // sum of the above four
  occupiedShannons: bigint // occupiedBytes * 1e8 — the minimum capacity this cell must hold
  freeShannons: bigint     // capacity - occupiedShannons — surplus above the byte requirement
}
```

The default `secp256k1_blake160_sighash_all` cell with no type and no data occupies exactly `8 + 32 + 1 + 20 = 61` bytes → `61 CKB`, which is the well-known minimum.

### 5.6 DecodedData

`data` is always kept as raw hex; `decodedData` is a best-effort, clearly-labeled interpretation driven by the cell's type script. It is a discriminated union so the UI can switch on `kind`.

```typescript
type DecodedData =
  | { kind: "empty" }                                    // data === "0x"
  | { kind: "udt"; amount: bigint; standard: "sudt" | "xudt" } // first 16 bytes, LE u128
  | { kind: "dao"; phase: "deposit" | "withdraw"; depositBlock?: bigint } // 8-byte LE u64
  | { kind: "spore"; contentType: string; content: string; clusterId?: string } // SporeData molecule
  | { kind: "cluster"; name: string; description: string } // ClusterData molecule
  | { kind: "raw"; hex: string }                         // unrecognized; show bytes + length only
```

Decode rules, all grounded in the type script's known identity (never on data length alone): UDT amount is `data[0..16]` as little-endian `u128` (identical for sUDT and plain xUDT). A Nervos DAO cell's 8-byte data is `0` → deposit, else the little-endian `u64` is the deposit block height → withdrawing. Spore/Cluster data are molecule tables. Everything else is `raw`. This is inference and must be rendered as such per §8.

### 5.7 DecodedWitness and KnownScript

```typescript
interface DecodedWitness {
  raw: string              // 0x + hex of the witness blob as it appears in the tx
  witnessArgs?: {          // present when the blob parses as molecule WitnessArgs
    lock?: string          // 0x + hex; conventionally the lock signature ("0x"/absent if none)
    inputType?: string     // 0x + hex; data for the input cell's type script
    outputType?: string    // 0x + hex; data for the output cell's type script
  }
}                          // witnesses are a flat list, indexed independently of inputs/outputs

interface KnownScript {
  name: string             // e.g. "secp256k1_blake160_sighash_all", "xUDT", "Nervos DAO"
  category: "lock" | "type"
  network: "mainnet" | "testnet"
  meaning: string          // one-line plain-language description for the detail panel
}
```

A witness is a plain byte blob; for default-lock inputs it is a molecule-serialized `WitnessArgs` and decodes into the three optional fields. Witnesses are excluded from the tx hash but are a separate top-level list — do not try to index them by input position. `KnownScript` is the registry match keyed by the `(codeHash, hashType)` pair (never `codeHash` alone — several scripts, e.g. xUDT, differ only by `hashType` across networks); an unmatched script leaves `known` undefined and renders as an unrecognized, shortened code hash.

### 5.8 Raw → normalized field mapping

The table maps each raw CKB JSON-RPC field to its normalized counterpart. Everything not marked as a hash or a byte string is a `0x`-hex integer parsed via `BigInt`. Fields marked "separate fetch" are not present in the primary `get_transaction` response and require an extra call during normalization.

| Raw JSON-RPC field | Normalized field | Transform / note |
|---|---|---|
| `tx.transaction.hash` | `Transaction.hash` | copied as-is (node adds this at verbosity 2) |
| `tx.transaction.version` | `Transaction.version` | `Number(BigInt(hex))` |
| `tx.tx_status.status` | `Transaction.status` | string enum, copied |
| `tx.tx_status.block_hash` | `Transaction.blockHash` | copied; null unless committed |
| `tx.tx_status.block_number` | `Transaction.blockNumber` | `BigInt(hex)`; null unless committed |
| `tx.tx_status.tx_index` | `Transaction.txIndex` | `Number(BigInt(hex))`; null unless committed |
| `tx.tx_status.reason` | `Transaction.rejectReason` | copied; present only when rejected |
| `tx.fee` | `Transaction.fee` | `BigInt(hex)`; nullable — fall back to computed fee |
| `tx.cycles` | `Transaction.cyclesConsumed` | `BigInt(hex)`; nullable |
| *(header)* `header.timestamp` | `Transaction.timestamp` | **separate fetch**: `get_header(block_hash)` → `BigInt(hex)` unix ms |
| `tx.transaction.inputs[i]` | `Transaction.inputs[i]` | one `Input` per element, in order |
| `inputs[i].previous_output` | `Input.outPoint` | `{ tx_hash, index }` → `{ txHash, index: Number(index) }` |
| `inputs[i].since` | `Input.since` | `BigInt(hex)` then decode per 5.3 |
| *(resolved cell)* | `Input.cell` | **separate fetch**: `get_live_cell(previous_output, true)`, else `get_transaction(previous_output.tx_hash)` → `outputs[index]` + `outputs_data[index]` (see 5.4) |
| `tx.transaction.outputs[i].capacity` | `Cell.capacity` | `BigInt(hex)` shannons |
| `tx.transaction.outputs[i].lock` | `Cell.lock` | `Script` (below) |
| `tx.transaction.outputs[i].type` | `Cell.type` | `Script` or null |
| `tx.transaction.outputs_data[i]` | `Cell.data` | copied hex; **index-aligned with `outputs[i]`** — the two arrays are equal length and zipped by position into one `Cell` |
| *(computed)* | `Cell.decodedData` | decode `data` per the cell's type script (5.6) |
| *(computed)* | `Cell.occupied` | derived from capacity + lock + type + data byte lengths (5.5) |
| `outputs[i].lock.code_hash` / `.hash_type` / `.args` | `Script.codeHash` / `.hashType` / `.args` | copied; `hash_type` string enum unchanged |
| *(computed)* | `Script.hash` | `ckbhash(molecule(script))` |
| *(registry)* | `Script.known` | lookup by `(codeHash, hashType)` (5.7) |
| `tx.transaction.cell_deps[i].out_point` | `CellDep.outPoint` | `{ txHash, index }` |
| `tx.transaction.cell_deps[i].dep_type` | `CellDep.depType` | `"code"` → `"code"`, `"dep_group"` → `"depGroup"` |
| `tx.transaction.header_deps[i]` | `Transaction.headerDeps[i]` | bare `0x`-hash, copied |
| `tx.transaction.witnesses[i]` | `Transaction.witnesses[i]` | `{ raw }`, plus `witnessArgs` from molecule decode (5.7) |

The `outputs` / `outputs_data` index alignment is load-bearing: the RPC returns them as two parallel arrays of equal length, and `outputs_data[i]` is the data for `outputs[i]`. The normalizer must zip them into a single `Cell[]` and never let them drift. The same index scheme applies when resolving a consumed input via `get_transaction` — `outputs[index]` and `outputs_data[index]` are read together.

## 6. Data sources and the source adapter

Everything ckb-viz renders comes from three kinds of backend, and each is good at something the others are not. A CKB node's JSON-RPC gives you the transaction and lets you resolve inputs backward, but it cannot look forward from a cell to whatever spent it. The node's built-in indexer (bundled since CKB `v0.105.0`, served on the same URL) can find spends, but only by script, so it takes a query-then-match dance to answer "who consumed this OutPoint." The Nervos Explorer REST API answers forward lineage in a single call, but its CORS policy locks out arbitrary browser origins. The right move is not to pick one, it is to hide all three behind a single interface and let the app ask for what it wants without knowing who answers.

### 6.1 The `TransactionSource` interface

One contract, three possible implementations. The app talks only to this.

```typescript
type Hex = `0x${string}`;
type Network = "mainnet" | "testnet";

interface OutPoint { txHash: Hex; index: number; }

// A cell resolved from an input's previous_output, with provenance.
interface ResolvedCell {
  output: CellOutput;          // capacity, lock, type
  data: Hex;                   // "0x" when empty
  // "live"       -> resolved via get_live_cell, still unspent
  // "consumed"   -> not live; recovered from the creating tx's outputs[index]
  // "unresolved" -> creating tx unavailable (pruned/unknown)
  origin: "live" | "consumed" | "unresolved";
}

interface HeaderView {
  hash: Hex;
  number: bigint;              // block height
  timestamp: bigint;          // unix MILLISECONDS
  epoch: bigint;              // packed epoch
}

interface TransactionSource {
  readonly network: Network;
  readonly capabilities: { forwardLineage: boolean };

  // Backward-resolvable from any node.
  getTransaction(hash: Hex): Promise<NormalizedTransaction>;
  resolveInput(outPoint: OutPoint): Promise<ResolvedCell>;
  getHeader(ref: { blockHash: Hex } | { blockNumber: bigint }): Promise<HeaderView>;
  getTipHeader(): Promise<HeaderView>;
  getChainInfo(): Promise<{ chain: string; isInitialBlockDownload: boolean }>;

  // Forward lineage. OPTIONAL: rejects with NotSupportedError when
  // capabilities.forwardLineage is false. Resolves null when the cell
  // is confirmed unspent, or a Hex tx hash when a consumer is found.
  findConsumingTx(outPoint: OutPoint): Promise<Hex | null>;
}

class NotSupportedError extends Error {}
```

The `capabilities.forwardLineage` flag is the graceful-degradation seam. The lineage view (§9.5 of the surface spec) checks it before offering a forward step: with a node-only source it is `false` and the forward affordance is hidden, not broken. Backward lineage is always available because it needs nothing but `getTransaction` and `resolveInput`.

Three concrete adapters implement this contract:

| Adapter | Backs | `forwardLineage` | Browser-direct |
| --- | --- | --- | --- |
| `NodeSource` | CKB JSON-RPC (`get_transaction`, `get_live_cell`, headers) | `false` | yes, CORS `*` |
| `IndexerSource` | `NodeSource` + built-in indexer (`get_transactions`) on the same URL | `true` | yes, CORS `*` |
| `ExplorerSource` | Explorer REST for one-shot forward lineage, node for the rest | `true` | no, needs proxy |

`IndexerSource` is the default for live use: it is proxy-free and the same endpoint serves both chain and indexer methods.

### 6.2 Node JSON-RPC methods

All requests are JSON-RPC 2.0 over HTTP `POST` with positional params. Every integer — capacity, index, since, timestamp, block number, cycles — is a `0x`-prefixed lowercase hex string and must be parsed with `BigInt`. Hashes are `0x` + 64 hex chars. Byte fields (`args`, cell data, witnesses) are `0x` + even-length hex, where `"0x"` means empty. Field names are `snake_case` on the wire; if you route through CCC you get `camelCase` entities instead.

The verified method surface the adapter uses:

| Method | Params (positional) | Returns / key fields |
| --- | --- | --- |
| `get_transaction` | `[tx_hash, verbosity?, only_committed?]` | `TransactionWithStatusResponse` |
| `get_live_cell` | `[out_point, with_data, include_tx_pool?]` | `CellWithStatus` |
| `get_header` | `[block_hash, verbosity?]` | `HeaderView` or `null` |
| `get_header_by_number` | `[block_number, verbosity?]` | `HeaderView` or `null` |
| `get_block_by_number` | `[block_number, verbosity?, with_cycles?]` | `BlockView` (only if you need per-tx cycles) |
| `get_tip_header` | `[verbosity?]` | `HeaderView` |
| `get_blockchain_info` | `[]` | `{ chain, median_time, epoch, difficulty, is_initial_block_download, alerts }` |

**`get_transaction(tx_hash, verbosity, only_committed)`** defaults `verbosity` to `2`. The response is a wrapper whose only non-nullable field is `tx_status`:

```jsonc
{
  "transaction": { /* TransactionView, or null */ },
  "cycles": "0x219" | null,
  "fee": "0x16923f7dcf" | null,
  "min_replace_fee": "0x16923f7f6a" | null,
  "time_added_to_pool": "0x187b3d137a1" | null,
  "tx_status": {
    "status": "pending" | "proposed" | "committed" | "unknown" | "rejected",
    "block_hash":   "0x..." | null,
    "block_number": "0x..." | null,
    "tx_index":     "0x..." | null,
    "reason":       "..."   | null
  }
}
```

Treat `cycles`, `fee`, `min_replace_fee`, `time_added_to_pool` as always-optional — they are pool metadata and are typically `null` once a tx is `committed`. At `verbosity=2` the node also injects a computed `hash` field into the `transaction` object that is not part of the raw molecule. `transaction` is `null` unless `status` is `pending`/`proposed`/`committed`; `verbosity=1` returns `transaction: null` by contract, and `verbosity=0` returns it as a single molecule-packed hex string. The adapter always requests `verbosity=2`. Only `committed` guarantees on-chain inclusion (with `block_hash`); `unknown` means never-seen-or-evicted; `rejected` carries a `reason`.

The `transaction` object is the shape §5's normalizer consumes: `version`, `cell_deps[]`, `header_deps[]` (bare `H256` hashes), `inputs[]`, `outputs[]`, `outputs_data[]` (index-aligned and equal-length with `outputs`), `witnesses[]` (a flat, independently-indexed array), and `hash`.

**Block context.** For a committed tx, read `tx_status.block_hash`, then call `get_header(block_hash, "0x1")` for `number` and `timestamp` — this is cheaper than `get_block` and returns exactly what the summary banner needs. `timestamp` is unix **milliseconds** as a `Uint64` hex; do not treat it as seconds.

**Network detection** is `get_blockchain_info().chain` (`"ckb"` = mainnet, `"ckb_testnet"` = testnet); tip height is `get_tip_header()` (or the lighter `get_tip_block_number`).

### 6.3 Resolving inputs

An `inputs[i]` carries only `previous_output` and `since` — no capacity, lock, type, or data. To show an input cell in full, the adapter resolves its `OutPoint`. There are two paths and the order matters, because a spent input is by definition no longer live:

```
resolveInput(outPoint):
  1. r = get_live_cell(outPoint, with_data = true)
     if r.status == "live":
        return { output: r.cell.output, data: r.cell.data.content ?? "0x", origin: "live" }

  2. // Not live -> it was consumed by this very tx (or later). Recover the
     //   original output from the transaction that created it.
     tx = get_transaction(outPoint.txHash)
     if tx.transaction exists and outPoint.index < outputs.length:
        return {
          output: tx.transaction.outputs[outPoint.index],
          data:   tx.transaction.outputs_data[outPoint.index] ?? "0x",
          origin: "consumed"
        }

  3. return { output: null, data: "0x", origin: "unresolved" }
```

`get_live_cell` returns `CellWithStatus = { cell, status, block_hash }` — three fields, not two: `block_hash` is the **creating** block's hash and is `null` unless the cell is live and committed. `status` is `"live"` or `"unknown"` in practice (`"dead"` was deprecated and removed in `v0.36.0`), so a consumed input comes back as `{ cell: null, status: "unknown", block_hash: null }`, which is exactly the fall-through to step 2. `cell` is `CellInfo { output, data }`; `data` is `CellData { content, hash }` (and is `null` if you passed `with_data = false`, which is not the same as empty data). The adapter passes `with_data = true` because the flow shows a data indicator per cell. `include_tx_pool` is a real optional third param (defaults `false`); the adapter omits it for maximum compatibility, since inputs to a committed tx are on-chain.

Because inputs to a confirmed transaction are always spent, in practice step 1 almost always misses and step 2 does the work. Step 1 still matters for a `pending`/`proposed` tx whose inputs are still live in the pool.

### 6.4 Forward lineage

A node cannot look forward: nothing in `CellWithStatus` names a consumer. Forward lineage needs one of two external answers, and `findConsumingTx` is where the adapter chooses.

**Via the built-in indexer (proxy-free, the default).** The indexer's `get_transactions` is keyed by a lock or type **script**, never by an `OutPoint`, so there is no single call for "who consumed cell X." The procedure:

```
findConsumingTx(outPoint):   // IndexerSource
  1. src = get_transaction(outPoint.txHash)
     script = src.transaction.outputs[outPoint.index].lock   // the consumed cell's lock
  2. rows = get_transactions({
       script, script_type: "lock", script_search_mode: "exact"
     }, order: "asc", limit: "0x64", after?)
  3. for each row where row.io_type == "input":
        cand = get_transaction(row.tx_hash)
        if cand.transaction.inputs[Number(row.io_index)].previous_output == outPoint:
           return row.tx_hash
  4. page with last_cursor until exhausted; return null if no input row matches
```

`get_transactions` returns `{ objects: IndexerTxWithCell[], last_cursor }` where each object is `{ tx_hash, block_number, tx_index, io_type: "input"|"output", io_index }` (all hex). An `io_type` of `"input"` means a cell bearing that script was consumed in `tx_hash` at `inputs[io_index]`, so you only compare that one input's `previous_output`. Set `group_by_transaction: true` to collapse per-io rows into one row per tx (`cells: [[io_type, io_index], ...]`). The `SearchKey` shape is `{ script, script_type, script_search_mode: "prefix"|"exact" (default "prefix"), filter?, group_by_transaction? }`, with `filter.block_range` `[start, end)` (hex, exclusive end) as the main narrowing knob for `get_transactions`. Use `script_search_mode: "exact"` and, where the cell has a distinctive type script, prefer keying on the **type** script to shrink the candidate set.

**Via the Explorer REST (one call, needs a proxy).** One `GET` on the tx that *created* the cell answers forward lineage for every output at once, so this path is `O(1)` where the indexer path is a paged scan:

```
findConsumingTx(outPoint):   // ExplorerSource
  GET {explorerApiUrl}/transactions/{outPoint.txHash}
  out = data.attributes.display_outputs[outPoint.index]
  return out.consumed_tx_hash === "" ? null : out.consumed_tx_hash
```

`display_outputs[i]` carries `{ status: "live"|"dead", consumed_tx_hash, generated_tx_hash, cell_index, capacity, occupied_capacity, address_hash, cell_type, type_script }`; `consumed_tx_hash` is `""` when live, else the spending tx. Backward lineage falls out of the same object via `display_inputs[i].generated_tx_hash`. Append `?display_cells=false` to omit the cell arrays when you only need the header.

**Graceful degradation.** `NodeSource.findConsumingTx` throws `NotSupportedError` and sets `capabilities.forwardLineage = false`. The UI hides the forward step; backward lineage still works everywhere. This is the §3 promise kept — the tool is fully useful against a bare node, and richer when an indexer or explorer is wired in.

### 6.5 Explorer REST base URLs and CORS reality

| Network | Explorer API base |
| --- | --- |
| mainnet | `https://mainnet-api.explorer.nervos.org/api/v1/` |
| testnet | `https://testnet-api.explorer.nervos.org/api/v1/` |

The endpoint the adapter uses is `GET /transactions/{hash}`. Every request — even a `GET` — must send **both** `Accept: application/vnd.api+json` and `Content-Type: application/vnd.api+json`; omitting `Content-Type` returns HTTP `415`. There is no endpoint that takes an `OutPoint` directly; cell status and `consumed_tx_hash` are surfaced only through the transaction endpoint's `display_outputs`.

The access story is the whole reason the source is configurable and the proxy is optional-but-expected:

- **Node RPC and its built-in indexer send permissive CORS** (`access-control-allow-origin: *`, verified live against `https://mainnet.ckb.dev/` and `https://testnet.ckb.dev/`). A browser app can call `get_transaction`, `get_live_cell`, headers, and `get_transactions` **directly, with no proxy**. This is why `IndexerSource` is the default.
- **The Explorer REST API uses an allowlist, not a wildcard.** It returns an `access-control-allow-origin` header only for pre-approved origins (e.g. `https://explorer.nervos.org`); an arbitrary origin gets no ACAO header and the browser blocks the response, preflight included. So `ExplorerSource` requires a same-origin proxy for any web origin that is not on the allowlist.

The practical posture: default to `IndexerSource` over `*.ckb.dev` for a zero-backend deployment; add a thin proxy only when you want the Explorer's one-shot lineage, an API key, a private/self-hosted node, or response caching. A settings field lets power users paste their own `rpcUrl` — CCC's `ClientPublicMainnet`/`ClientPublicTestnet` take a `url` option and default to `wss://mainnet.ckb.dev/ws` (falling back to `https://mainnet.ckb.dev/`), so pointing the app at any node is a one-line change. These `*.ckb.dev` endpoints are community-run with no documented rate-limit or uptime SLA; treat them as best-effort and keep the URL swappable.

### 6.6 Configuration

Network selection drives a small config record. `indexerUrl` is optional because the built-in indexer lives on the node URL; supply it only to point at a standalone indexer. `explorerApiUrl` is optional and, when set, is expected to be a proxy path.

```typescript
interface NetworkConfig {
  rpcUrl: string;            // node JSON-RPC; also serves the built-in indexer
  indexerUrl?: string;       // override only for a standalone ckb-indexer
  explorerApiUrl?: string;   // Explorer REST base, usually a proxy path
}

const CONFIG: Record<Network, NetworkConfig> = {
  mainnet: {
    rpcUrl: "https://mainnet.ckb.dev/",
    explorerApiUrl: undefined, // e.g. "/api/explorer/mainnet" behind a proxy
  },
  testnet: {
    rpcUrl: "https://testnet.ckb.dev/",
    explorerApiUrl: undefined, // e.g. "/api/explorer/testnet"
  },
};
```

Adapter selection follows from the config: an `explorerApiUrl` yields `ExplorerSource`; otherwise `IndexerSource` over `rpcUrl` (which is also `IndexerSource`'s indexer endpoint). Switching networks swaps both the config record and the per-network script registry (§ script registry).

### 6.7 Bundled examples, caching, and retry posture

**Bundled examples (zero config).** The app ships a handful of committed transactions — one per decoded category (a plain CKB transfer, a UDT transfer, a Nervos DAO deposit, a Spore mint) — as static JSON captured in the normalized §5 shape, including pre-resolved input cells. A `BundledSource` implements `TransactionSource` against this fixture set so the entire tool is explorable with no endpoint configured and no network access; `findConsumingTx` for a bundled tx returns any recorded consumer or `null`. The example picker in the input bar loads these first, which also makes the tool demoable offline.

**Caching (TanStack Query).** Confirmed transactions and their cells are immutable, so caching is trivially correct. Wrap every read in TanStack Query with stable, source-scoped keys and effectively infinite freshness:

| Query | Key | Policy |
| --- | --- | --- |
| transaction | `["tx", network, hash]` | `staleTime: Infinity`, long `gcTime` |
| resolved input cell | `["cell", network, txHash, index]` | `staleTime: Infinity` |
| header | `["header", network, blockHashOrNumber]` | `staleTime: Infinity` |
| forward lineage | `["consumer", network, txHash, index]` | short `staleTime` — an unspent cell can later be spent |
| tip / chain info | `["tip", network]` | short `staleTime` (seconds) |

Namespace keys by `network` so a mainnet/testnet toggle never serves a cross-network cache hit. Forward-lineage and tip are the only entries with a bounded `staleTime`, because a cell that reads unspent today can be consumed tomorrow.

**Rate limits and retries.** The public endpoints publish no rate limits, so the adapter is a conservative client: cap concurrent input-resolution fan-out (a large transaction can trigger dozens of `get_transaction` calls in §6.3 — bound this to a small pool, e.g. 6–8 in flight, and dedupe identical OutPoints through the query cache). Retry transient network and `5xx` failures with capped exponential backoff and jitter (e.g. 3 attempts, 250ms base), but never retry a well-formed JSON-RPC `error` or an HTTP `4xx` — those are deterministic. Surface a plain-language failure in the UI when retries are exhausted, per the §10 quality floor, rather than spinning.

## 7. Script registry

Every lock and type Script on CKB is just three fields — `code_hash`, `hash_type`, `args` — and none of them carry a human-readable name. Turning `0x9bd7e06f…` into "Secp256k1 (default lock)" is a pure lookup problem, and the registry is the table that lookup consults. It is deliberately plain data: a map from a script's identity to a small metadata record. No logic lives in the registry itself; the resolver that reads it is the only code.

### 7.1 Data model

The registry is keyed **per network**, because the same script frequently has a different `code_hash` on mainnet (Lina) versus testnet (Aggron) — ACP, Omnilock, JoyID, RGB++, sUDT, xUDT, Spore and Cluster all diverge. A single flat table would collide or mislabel. Each network gets its own map.

The lookup key is the pair `(code_hash, hash_type)`, canonicalised as a string so it can index a plain `Map`. `hash_type` is part of the key, not a detail: several scripts share a name but differ in `hash_type` across networks (xUDT is `data1` on mainnet but `type` on testnet), and multisig ships both a v1 (`type`) and a v2 (`data1`) under different code hashes. Keying on `code_hash` alone would be ambiguous; keying on the pair is exact.

```ts
type Network = 'mainnet' | 'testnet';
type HashType = 'data' | 'type' | 'data1' | 'data2';
type Category = 'lock' | 'type';

interface ScriptEntry {
  name: string;                    // "Secp256k1 (default lock)"
  category: Category;              // 'lock' | 'type'
  meaning: string;                 // one-line human explanation
  docsUrl?: string;                // RFC or SDK reference
  decoder?: DecoderId;             // cell-data / args decoder to apply (see §8)
  argsMatcher?: ArgsMatcher;       // optional per-instance refinement (see §7.3)
}

// key = `${code_hash}:${hash_type}`, lowercased
type Registry = Record<Network, Map<string, ScriptEntry>>;
```

`decoder` is a reference (an id or function handle) into the decoding layer, not inline logic — an sUDT type entry points at the "u128 LE amount" decoder, a Nervos DAO entry at the "deposit/withdraw phase" decoder, a Spore entry at the `SporeData` molecule decoder. The registry says *what* a cell is; the decoder says *how to read it*.

### 7.2 Lookup

Resolution is a single function. Given a Script and the active network:

```
resolve(script, network):
  key = lower(script.code_hash) + ':' + script.hash_type
  entry = registry[network].get(key)
  if entry is undefined:
    return unknownScript(script)          // §7.4
  refinement = entry.argsMatcher?(script.args)   // §7.3, optional
  return { ...entry, ...refinement }
```

The network is fixed once per session from `get_blockchain_info().chain` (`ckb` → mainnet, `ckb_testnet` → testnet), so the resolver never guesses which table to read. Because a confirmed script's identity never changes, the resolved label can be cached alongside the cell.

### 7.3 Args-pattern matching

The open question was whether the registry should match on `args` as well as `(code_hash, hash_type)`. The answer: **default to `(code_hash, hash_type)` keying, and add an optional `argsMatcher` only where a script needs per-instance refinement.**

The reasoning is that `code_hash` already pins the exact binary — two genuinely different scripts cannot share a `(code_hash, hash_type)` pair, so `args` is never needed to *select* the base identity. What `args` does carry is instance-specific detail: an sUDT or xUDT type script uses the same `code_hash` for every token, and its first 32 bytes of `args` are the owner lock-script hash that distinguishes one token from another. That is refinement, not selection.

So `argsMatcher` runs **after** the base match and only decorates the result — it attaches a sub-label or decoded identity (e.g. the owner-lock hash, or a known-token name looked up from that hash) and never rejects the match. The fallback order is:

1. Look up `(code_hash, hash_type)` in the network table. This determines identity.
2. If the matched entry has an `argsMatcher`, run it against `args` to produce an optional refinement (a more specific `name`, extra display fields). If it returns nothing, the base entry stands unchanged.
3. If step 1 finds nothing, fall through to the unknown-script rendering (§7.4).

An `argsMatcher` is therefore `(args: Hex) => Partial<ScriptEntry> | undefined`. This keeps the common case — a script that is fully identified by its code hash — free of any args logic, while giving token-like scripts a clean hook to say "this is *this specific* token". It also leaves room for the rare future case of one binary encoding several sub-variants in `args`, without changing the key shape.

### 7.4 Unknown scripts

A `(code_hash, hash_type)` not present in the network table is **rendered as a shortened `code_hash`, clearly marked as unrecognized, and never guessed.** Concretely: show the category (`lock`/`type`, which is known from the cell field the script sits in), a shortened hash like `0x9bd7e0…a3cce8`, and an explicit "unrecognized script" tag with the full hash available on hover/expand. The visualizer must not infer a name from a partial match, a similar hash, or the `args` shape — an unlabelled script is shown as exactly that. Silent mislabelling is worse than an honest "unknown", because a viewer trusts the label to mean the code was verified.

### 7.5 Extensibility

Because the registry is plain data, extending it is adding rows — no code changes to the resolver. New scripts (a new wallet lock, a new token standard) are appended to the appropriate network map; a `decoder` or `argsMatcher` is added only if the new script carries structured data or per-instance identity worth surfacing. The registry can be shipped as a static module, hydrated from CCC's built-in `KnownScript` config (which already carries per-network `ScriptInfo`), or merged from a user-supplied list — all three produce the same `Map`. Keeping logic out of the table is what makes it safe for non-authors to contribute entries.

### 7.6 Seed entries

The table below is the initial registry, drawn only from the verified bundle. `code_hash`/`hash_type` values are **reference data**: they are transcribed from RFC0024, RFC0023, the CCC known-scripts config, and the rgbpp/spore SDKs, and must be **verified against the live deployment at build or runtime** (query genesis/deployment cells, or resolve type-id cell deps live) before they are trusted — cell binaries can be redeployed. The `code_hash` values here are all CONFIRMED in the bundle; where a value could not be verified it is shown as `verify` rather than fabricated.

| Name | Category | Network | `code_hash` | `hash_type` |
|---|---|---|---|---|
| Secp256k1 (default lock) | lock | mainnet | `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8` | `type` |
| Secp256k1 (default lock) | lock | testnet | `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8` | `type` |
| Secp256k1 multisig (v1) | lock | mainnet | `0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8` | `type` |
| Secp256k1 multisig (v1) | lock | testnet | `0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8` | `type` |
| Anyone-Can-Pay (ACP) | lock | mainnet | `0xd369597ff47f29fbc0d47d2e3775370d1250b85140c670e4718af712983a2354` | `type` |
| Anyone-Can-Pay (ACP) | lock | testnet | `0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356` | `type` |
| Omnilock | lock | mainnet | `0x9b819793a64463aed77c615d6cb226eea5487ccfc0783043a587254cda2b6f26` | `type` |
| Omnilock | lock | testnet | `0xf329effd1c475a2978453c8600e1eaf0bc2087ee093c3ee64cc96ec6847752cb` | `type` |
| JoyID | lock | mainnet | `0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323` | `type` |
| JoyID | lock | testnet | `0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac` | `type` |
| RGB++ lock | lock | mainnet | `0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936` | `type` |
| RGB++ lock (BTC testnet3) | lock | testnet | `0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248` | `type` |
| sUDT | type | mainnet | `0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5` | `type` |
| sUDT | type | testnet | `0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4` | `type` |
| xUDT | type | mainnet | `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95` | `data1` |
| xUDT | type | testnet | `0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb` | `type` |
| Nervos DAO | type | mainnet | `0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e` | `type` |
| Nervos DAO | type | testnet | `0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e` | `type` |
| Spore (V2) | type | mainnet | `0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5` | `data1` |
| Spore (V2) | type | testnet | `0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d` | `data1` |
| Cluster (V2) | type | mainnet | `0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075` | `data1` |
| Cluster (V2) | type | testnet | `0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058` | `data1` |

Notes on specific rows:

- **xUDT hash_type differs by network** — `data1` on mainnet, `type` on testnet. This is a genuine, doubly-confirmed asymmetry, not a transcription error, and it is exactly why `hash_type` is part of the key.
- **RGB++ lock** also has a distinct BTC-Signet testnet variant (`0xd07598de…5a220364`, `type`); add it as a separate testnet row if the viewer targets Signet.
- **DOB is not a distinct on-chain script.** A "Digital Object" is a Spore cell whose `content` carries DOB/0 or DOB/1 rendering rules; on-chain its type script *is* the Spore type (or the Spore-DID variant, mainnet `0xcfba73b5…f641cb33` / testnet `0x0b1f412f…cc6e890f`, both `hash_type: type`). DOB detection therefore keys on the Spore/Cluster entries above plus a content-type check in the decoder — the registry gets no separate "DOB" hash. Do not invent one.
- Legacy variants (Spore V1, Cluster V1, multisig V2/V2Beta) exist in the bundle and can be seeded the same way; they are omitted here to keep the seed table to the well-known set.

All values above are reference data and must be re-verified against the live chain at build or runtime; treat any hash the source cannot confirm as `verify` and render such a script through the unknown-script path (§7.4) until confirmed.

## 8. Transaction decoder

The decoder turns a resolved transaction — every input's `previous_output` already fetched into a full `CellOutput` + data, every output paired with its `outputs_data[i]` — into a one-sentence plain-language headline plus a structured result the UI can key off. It is a labeling layer, not a semantic oracle: CKB has no on-chain notion of "intent," so every conclusion here is *inferred* from script identities, cell data, and the input/output shape. The decoder never invents intent it cannot see. When it cannot classify a transaction, it says "N inputs → M outputs" and names the dominant script, rather than guessing.

Two hard rules govern the whole section:

1. **Every field carrying inference is marked `inferred: true`.** A capacity read from a cell is fact; "this is a UDT transfer" is inference. The UI renders inferred labels with a visual affordance (a dotted underline, a small "inferred" tag) so a reader never mistakes a guess for on-chain truth.
2. **Unknown is a first-class answer.** If inputs are unresolved, a token name is not in the registry, or a script is unrecognized, the decoder emits `null`/`"unknown"` for that slot and lowers `confidence` — it does not fabricate a plausible-looking value.

### 8.1 The `DecodeResult` contract

Every classifier produces the same shape:

```ts
type DecodeKind =
  | "ckb_transfer"       // plain capacity movement, default locks only, no type scripts
  | "udt_transfer"       // sUDT / xUDT on inputs and/or outputs
  | "dao_deposit"        // Nervos DAO cell created (phase 0)
  | "dao_withdraw"       // Nervos DAO cell consumed (phase 1/2)
  | "spore_mint" | "spore_transfer" | "spore_melt"
  | "cluster_mint" | "cluster_transfer"
  | "structural";        // fallback: shape described, no intent asserted

type DecodeResult = {
  kind: DecodeKind;
  headline: string;               // one sentence, plain language, always prefixed as inferred
  confidence: "high" | "medium" | "low";
  details: Record<string, unknown>; // kind-specific structured payload (amounts, token id, ...)
  inferred: true;                 // this whole object is a best-effort label
  warnings: string[];             // e.g. "inputs unresolved: fee unavailable"
};
```

`confidence` is coarse and honest: `high` when the classification rests only on well-known `(code_hash, hash_type)` matches and self-consistent data; `medium` when a token name or a script had to be resolved from a secondary source; `low` when inputs were unresolved or the shape only *loosely* fit a template. The headline is generated last, from `details`, so it can never contradict the structured payload.

### 8.2 Classification decision tree

The classifier runs top to bottom and returns on the **first** matching rule. Order matters: DAO and UDT are checked before the plain-transfer rule because a plain transfer is defined by the *absence* of type scripts. Script recognition is by `(code_hash, hash_type)` pair against the network-specific known-scripts table (§ referenced elsewhere), never `code_hash` alone — recall that xUDT is `hash_type=data1` on mainnet but `type` on testnet, so matching on `code_hash` only would still be wrong to *label* without the pair.

```
decode(tx, resolvedInputs):

  # --- Precondition: are inputs resolved? ---
  inputsResolved = every input has a fetched CellOutput
  # (unresolved lowers confidence and disables fee/flow math, but
  #  classification on OUTPUT type scripts still works)

  typesIn  = multiset of recognized type-script kinds over resolvedInputs
  typesOut = multiset of recognized type-script kinds over outputs

  # 1. NERVOS DAO  (check before UDT/plain)
  if DAO type appears in typesOut:
      classify each DAO output by its 8-byte data:
        data == 0x00..00 (all zero)  -> deposit cell
        data != 0                    -> withdrawing cell (phase 1)
      if any DAO output is a deposit cell:
          return dao_deposit
      # DAO outputs that are all withdrawing cells = phase 1 rebind
      return dao_withdraw           # (see note below on inputs)
  if DAO type appears in typesIn and NOT in typesOut:
      return dao_withdraw           # phase 2: unlock + claim compensation

  # 2. SPORE / CLUSTER  (NFT-like; identity by type-id in args)
  if any Spore or Cluster type present:
      for each distinct spore/cluster id, look at membership:
        in outputs only            -> mint
        in inputs only             -> melt (spore) / (cluster has no melt in practice)
        in both inputs and outputs -> transfer
      return spore_mint | spore_transfer | spore_melt
             | cluster_mint | cluster_transfer   (per dominant id)

  # 3. UDT  (sUDT / xUDT)
  if any sUDT/xUDT type present on inputs or outputs:
      group cells by token id (= blake2b of the full type Script)
      for each token id: sumIn  = Σ amount over input cells with that type
                         sumOut = Σ amount over output cells with that type
      return udt_transfer

  # 4. PLAIN CKB TRANSFER
  if NO output has a type script
     AND NO resolved input has a type script
     AND every output lock is a recognized default/standard lock:
      partition outputs into:
        change     = outputs whose lock matches SOME input lock
        recipients = the rest
      return ckb_transfer

  # 5. STRUCTURAL FALLBACK
  return structural   # "N inputs -> M outputs", name the dominant script, assert nothing
```

**Note on the DAO branch.** A DAO deposit is unambiguous from the output side alone (a DAO-typed output whose data is 8 zero bytes). A DAO withdrawal spans two phases: phase 1 rebinds a deposit cell into a withdrawing cell (DAO type in *both* inputs and outputs, output data = deposit block height), and phase 2 consumes the withdrawing cell to release capacity + compensation (DAO type in inputs, gone from outputs, and `header_deps` present). The tree collapses both into `dao_withdraw`; `details.phase` distinguishes them (`1` if DAO type also on outputs, `2` if only on inputs).

Per-kind `details` payloads:

| kind | key fields in `details` |
|---|---|
| `ckb_transfer` | `recipients: [{address, capacityShannons}]`, `changeShannons`, `sentShannons` (Σ recipients) |
| `udt_transfer` | `tokens: [{tokenId, name?, symbol?, decimals?, sumIn, sumOut, netMinted?}]` |
| `dao_deposit` | `deposits: [{capacityShannons, address}]`, `totalDepositShannons` |
| `dao_withdraw` | `phase`, `withdrawing: [{depositBlock, capacityShannons}]`, `compensationShannons?` |
| `spore_*` / `cluster_*` | `id`, `clusterId?`, `contentType?`, `name?`, `action` (`mint`/`transfer`/`melt`) |
| `structural` | `inputCount`, `outputCount`, `dominantScript: {label, kind, count}` |

**Headline generation** reads only `details`. Examples (all rendered with an "inferred" affordance in the UI):

- `ckb_transfer` → *"Inferred: transfer of 1,234.5 CKB to 1 recipient (plus change)."*
- `udt_transfer` → *"Inferred: transfer of 500 USDC (sUDT); 500 in → 500 out, balanced."* — if `sumIn ≠ sumOut`, headline says *"…; 0 in → 1,000 out, 1,000 minted"* (owner-mode issuance) rather than claiming a plain transfer.
- `dao_deposit` → *"Inferred: Nervos DAO deposit of 10,000 CKB."*
- `dao_withdraw` → *"Inferred: Nervos DAO withdrawal (phase 2), 10,000 CKB deposit + compensation released."*
- `spore_mint` → *"Inferred: mint of 1 Spore (image/png) in cluster 0xabc… ."*
- `structural` → *"3 inputs → 2 outputs; dominant script: xUDT (type, 2 cells). Intent not determined."*

The `structural` headline is deliberately flat. It never says "swap," "batch," or any word implying purpose the chain does not record.

### 8.3 Field decoder — sUDT / xUDT amount

Both sUDT and xUDT store the token amount in the **first 16 bytes of cell data as a little-endian unsigned 128-bit integer** (RFC0025, RFC0052, both CONFIRMED). This is identical for the two standards; xUDT may append `XudtData` (`table { lock: Bytes, data: BytesVec }`) after the 16 amount bytes, which the amount decoder ignores.

```ts
function decodeUdtAmount(dataHex: string): bigint | null {
  const bytes = hexToBytes(dataHex);      // "0x..." -> Uint8Array
  if (bytes.length < 16) return null;      // not a valid UDT cell; do NOT assume 0
  let amount = 0n;
  for (let i = 15; i >= 0; i--) amount = (amount << 8n) | BigInt(bytes[i]); // LE
  return amount;
}
```

**Token identity** is the blake2b hash of the full type `Script` (`code_hash + hash_type + args`) — *not* anything parsed out of the args. For sUDT/xUDT the first 32 bytes of the type args are the **owner lock script hash**, never a human name. To render a name/symbol/decimals the decoder consults, in order: (1) the token's linked Unique/token-info cell if present, (2) an off-chain token list keyed by the type-script hash, (3) otherwise leave `name`/`symbol` `null` and display the raw type hash. `details.tokens[i].netMinted = sumOut - sumIn`; a positive value means owner-mode issuance, a negative value means burn, and the headline reflects whichever is true rather than always saying "transfer."

The **Unique / token-info cell** layout (positional, length-prefixed — *not* molecule): `byte0 = decimals (u8)`, `byte1 = name length (u8)`, `name (UTF-8)`, then `symbol length (u8)`, `symbol (UTF-8)`, with an optional `tag(4) | len(4) | data` trailer. This layout is medium-confidence (read from the utxostack/unique-cell repo, not the canonical encoder) — decode defensively, bounds-check every length, and fall back to "unknown token" on any overrun. Display amount as `rawAmount / 10^decimals`; if `decimals` is unknown, show the raw integer and mark it unscaled.

Reference `(code_hash, hash_type)` — **verify against the live deployment before trusting for anything beyond labeling**:

| token | network | `code_hash` | `hash_type` |
|---|---|---|---|
| sUDT | mainnet | `0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5` | `type` |
| sUDT | testnet | `0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4` | `type` |
| xUDT | mainnet | `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95` | `data1` |
| xUDT | testnet | `0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb` | `type` |

### 8.4 Field decoder — Nervos DAO deposit/withdraw data

The Nervos DAO type script is the same on both networks: `code_hash = 0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e`, `hash_type = type`, `args = 0x` (empty) — CONFIRMED. A DAO cell's data is **always exactly 8 bytes** (RFC0023, CONFIRMED):

```ts
function decodeDaoCell(dataHex: string): { phase: 0 | 1; depositBlock: bigint | null } {
  const bytes = hexToBytes(dataHex);
  if (bytes.length !== 8) throw new Error("not a DAO cell (data must be 8 bytes)");
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i]); // LE u64
  return v === 0n
    ? { phase: 0, depositBlock: null }   // deposit cell (all zeros)
    : { phase: 1, depositBlock: v };     // withdrawing cell; v = deposit block height
}
```

`v === 0` marks a fresh **deposit** cell; any non-zero value is the **block number of the deposit cell's including block**, packed as a 64-bit LE integer, marking a **withdrawing** cell. Compensation (the DAO interest) is not stored in the cell — it is computed from the DAO header fields (`ar` accumulated rate) of the deposit block and the withdraw block via `header_deps`. The decoder surfaces `compensationShannons` only when both headers are available; otherwise it emits `null` and a warning rather than a fabricated figure.

### 8.5 Field decoder — Spore / Cluster molecule fields

Spore cell data is `table SporeData { content_type: Bytes, content: Bytes, cluster_id: BytesOpt }` (CONFIRMED, `spore_v1.mol`). Cluster cell data is `table ClusterData { name: Bytes, description: Bytes }` (v1) or `table ClusterDataV2 { name: Bytes, description: Bytes, mutant_id: BytesOpt }` (v2). Both are molecule tables — decode with the standard table reader (4-byte LE total-size header, then a 4-byte LE offset per field). `content_type` is a UTF-8 MIME string (e.g. `image/png`, possibly with params like `immortal=true`); `content` is raw asset bytes (or a DOB DNA/JSON payload); `cluster_id`, when present, is the 32-byte id of the owning cluster.

A spore's own **id is its type-script args** — a 32-byte Type-ID (`blake2b(first_input.outpoint ‖ output_index)`), stable across the cell's life. Cluster id is likewise its own type-script Type-ID args. This is what the mint/transfer/melt classifier groups on: match a spore/cluster **id** across inputs and outputs, not the whole cell.

The decoder extracts metadata only (`content_type`, `content` length, `cluster_id`, cluster `name`/`description`). It does **not** attempt DOB/0 or DOB/1 trait rendering (DNA + cluster-pattern + external decoder binary) inline — that is a higher layer best delegated to a DOB decoder service or the CCC DOB SDK. If `content_type` indicates a renderable image and `content` is inline, the UI may preview it; otherwise it shows the MIME type and byte size and nothing more.

Reference Spore/Cluster type scripts (all `hash_type = data1` for V2; **verify against deployment**):

| script | network | `code_hash` |
|---|---|---|
| Spore V2 | mainnet | `0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5` |
| Spore V2 | testnet | `0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d` |
| Cluster V2 | mainnet | `0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075` |
| Cluster V2 | testnet | `0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058` |

### 8.6 Field decoder — the `since` field

`since` is a `u64` on each `CellInput`, serialized little-endian. `since == 0` means "no timelock" and the decoder renders nothing. Otherwise the **high byte carries flags** and the **low 56 bits carry the value** (RFC0017, CONFIRMED):

- bit 63 (`0x80` of the high byte): `1` = **relative**, `0` = **absolute**
- bits 62–61: metric — `00` block number, `01` epoch (fraction-packed), `10` median block timestamp (seconds), `11` invalid
- bits 60–56: reserved, must be zero
- bits 55–0: the value

High-byte flag combinations: `0x00` absolute block, `0x20` absolute epoch, `0x40` absolute timestamp, `0x80` relative block, `0xA0` relative epoch, `0xC0` relative timestamp.

```ts
function decodeSince(sinceU64: bigint): string {
  if (sinceU64 === 0n) return "no timelock";
  const flags = Number((sinceU64 >> 56n) & 0xffn);
  const value = sinceU64 & 0x00ffffffffffffffn;          // low 56 bits
  const relative = (flags & 0x80) !== 0;
  const metric = (flags >> 5) & 0x03;                     // 0 block, 1 epoch, 2 timestamp
  const rel = relative ? "relative " : "absolute ";
  switch (metric) {
    case 0: return `${rel}block ${value}`;
    case 1: {                                             // epoch: E|I|L packed
      const E = value & 0xffffffn;                        // bits 0-23
      const I = (value >> 24n) & 0xffffn;                 // bits 24-39
      const L = (value >> 40n) & 0xffffn;                 // bits 40-55
      const epoch = L === 0n ? `${E}` : `${E} + ${I}/${L}`;
      return `${rel}epoch ${epoch}`;
    }
    case 2: return `${rel}timestamp ${new Date(Number(value) * 1000).toISOString()}`;
    default: return "invalid since (metric=0b11)";
  }
}
```

For the epoch metric the 56-bit value is itself packed: epoch number `E` in bits 0–23, index `I` in bits 24–39, length `L` in bits 40–55, rendered as `E + I/L` (CONFIRMED). Relative timestamps/blocks are counted from the input cell's inclusion, so the decoder labels them "relative" and does not resolve them to an absolute wall-clock unless it also has the source cell's block.

### 8.7 Field decoder — `WitnessArgs`

Each entry in `tx.witnesses` is an independent `Bytes` blob (indexed separately from inputs). For cells using standard locks the blob is a molecule `table WitnessArgs { lock: BytesOpt, input_type: BytesOpt, output_type: BytesOpt }` (CONFIRMED, `blockchain.mol`). Convention: the lock script's proof (e.g. a 65-byte secp256k1 recoverable signature for the default lock) lives in `lock`; input/output type scripts read `input_type`/`output_type`.

The decoder attempts a `WitnessArgs` parse and, on success, displays which fields are present and their byte lengths (it does **not** try to interpret a signature's contents). A witness may legitimately **not** be `WitnessArgs` — some scripts consume a raw byte string. So the parse is best-effort: on molecule-decode failure, fall back to showing the raw hex and its length, labeled "non-WitnessArgs witness," rather than erroring. Witnesses are excluded from the tx hash but bound into the lock's signing message, a caveat worth surfacing in a tooltip but not something the decoder can verify.

### 8.8 Field decoder — address from a lock

A ckb2021 full address is the bech32m encoding of `payload = 0x00 ‖ code_hash(32) ‖ hash_type(1) ‖ args` (RFC0021, CONFIRMED). Note the order: `code_hash` **then** `hash_type` — the reverse is the single most common mis-implementation. The format byte `0x00` selects the full/bech32m form; the HRP is `ckb` on mainnet and `ckt` on testnet (so addresses read `ckb1…` / `ckt1…`). The `hash_type` byte encodes `data=0`, `type=1`, `data1=2`, `data2=4` (the `data2=4` mapping is reference/low-confidence — verify against `util/gen-types/src/core.rs` before relying on it).

```ts
function lockToAddress(lock: Script, network: "ckb" | "ckt"): string {
  const hashTypeByte = { data: 0x00, type: 0x01, data1: 0x02, data2: 0x04 }[lock.hashType];
  const payload = concat(
    Uint8Array.of(0x00),          // full-address format byte
    hexToBytes(lock.codeHash),    // 32 bytes
    Uint8Array.of(hashTypeByte),  // 1 byte
    hexToBytes(lock.args),        // variable
  );
  return bech32m.encode(network, convertBits(payload, 8, 5, true), Infinity);
}
```

Do not hand-roll the 8→5-bit conversion for production; use an audited implementation (CCC's `ccc.Address`, or Lumos's `encodeToAddress`). The decoder should also *parse* legacy short and deprecated-full addresses for display of historical data, but only ever *emit* the full bech32m form. Every lock in the transaction — input source locks and output locks alike — is rendered to an address chip; unrecognized locks still produce a valid address (the address encodes the raw script), so "unknown lock" and "unaddressable" are distinct states.

### 8.9 Field decoder — capacity and fee

Capacity is a `u64` count of shannons; `1 CKB = 10^8 shannons`. Display divides by `10^8` with tabular/monospaced digits. The transaction fee is:

```
fee = Σ inputs.capacity − Σ outputs.capacity
```

This is exact only when **every input is resolved** to its source `CellOutput` (inputs carry no capacity of their own — only a `previous_output` pointer). The guard is mandatory:

```ts
function computeFee(resolvedInputs: (CellOutput | null)[], outputs: CellOutput[]) {
  if (resolvedInputs.some(c => c === null)) {
    return { feeShannons: null, warning: "inputs unresolved: fee unavailable" };
  }
  const inSum  = resolvedInputs.reduce((a, c) => a + hexToBigInt(c!.capacity), 0n);
  const outSum = outputs.reduce((a, c) => a + hexToBigInt(c.capacity), 0n);
  const fee = inSum - outSum;
  // sanity: a valid non-issuance tx has fee >= 0; a negative result means
  // an input was mis-resolved OR this is a cellbase (no real inputs).
  return fee < 0n
    ? { feeShannons: null, warning: "computed fee < 0 (cellbase or unresolved input?)" }
    : { feeShannons: fee, warning: null };
}
```

Never display a fee derived from partially-resolved inputs — a single missing input silently understates the input sum and produces a wrong, confidently-rendered number. When the wrapper `get_transaction` response carries a `fee` field (pool metadata, present while pending/proposed), prefer it and label it as node-reported; once committed that field is typically `null`, so the computed value above becomes the source of truth. A **cellbase** transaction has no real inputs and mints capacity, so the fee formula does not apply — detect it (first input's `previous_output.tx_hash` is all-zero) and label it "cellbase (block reward)" instead of reporting a fee.

## 9. Surfaces and UX

One screen. Everything lives in a single main view — an input bar, a summary banner, and the flow — with the detail panel and the lineage view layered on top of it rather than routed to separate pages. This section specifies the behavior and layout of each surface in enough detail to build from. Visual tokens (color, type, spacing, motion timing) are §10's job; here we say what each surface *does*, what it shows, and how it responds.

The three data reads behind these surfaces (per §6): `get_transaction(tx_hash, "0x2")` for the transaction and its `tx_status`; per-input resolution of `previous_output` via `get_live_cell` with a fallback to `get_transaction(previous_output.tx_hash)` + `outputs[index]`; and, for forward lineage only, an indexer or the explorer API. All three feed the same normalized `Transaction` shape from §5, so every surface renders from that shape and never from raw RPC.

### 9.1 Main view — input bar

The input bar is the only place the user types. It has three controls.

**Hash field.** A single text input for a transaction hash. Validate against `^0x[0-9a-fA-F]{64}$` — a CKB `H256` is `0x` followed by exactly 64 hex characters. Trim surrounding whitespace and lowercase the hex before validating and querying (RPC hashes are lowercase). Validation is live but quiet: the field is neutral while empty or while the user is mid-type, and only shows an invalid state once the value is non-empty and fails the pattern, with a plain message — "A transaction hash is `0x` followed by 64 hex characters." Submit is enabled only on a valid hash (Enter or the load control). Pasting a hash with surrounding characters (an explorer URL, a trailing space) should strip to the first `0x`-prefixed 64-hex run rather than reject outright, so a paste from anywhere Just Works. On submit, the hash becomes the active route state so the view is shareable and reload-safe.

**Network selector.** Mainnet and testnet. Switching network is a hard context change: it swaps the RPC endpoint (`https://mainnet.ckb.dev/` vs `https://testnet.ckb.dev/` by default, or the user's configured endpoint) *and* the per-network script registry, then re-resolves the current hash against the new network. Because code hashes differ across networks (§7), the same hash can decode differently or not exist on the other network — if it 404s (status `unknown`) after a switch, that is a normal "not found on this network" error, not a failure. The selected network is part of shareable state.

**Example-tx menu.** A small menu of bundled example transactions, **one per decoded category**, so every decode path and every feature is reachable without hunting for a live hash. At minimum: a plain CKB transfer, a UDT (sUDT/xUDT) token transfer, a Nervos DAO deposit, a DAO withdrawal, a Spore mint, and one deliberately-unknown-script transaction that exercises the fallback decode. Examples are bundled as fixtures (their full `get_transaction` response plus resolved input cells) so the tool is fully explorable with **no endpoint configured and no network** — picking an example loads instantly from the fixture, sets the network selector to match the fixture's network, and skips the RPC path entirely.

### 9.1b Summary banner

Directly below the input bar, spanning the width. It answers "what did this transaction do?" before the user reads a single cell.

The **headline** is the plain-language decode from §8 — "CKB transfer", "Token transfer — 1,500 USDC (xUDT)", "Nervos DAO deposit", "Spore mint", or the structural fallback ("12 inputs → 3 outputs, xUDT") when intent can't be inferred. The headline is always labeled as inferred where it is inferred (a small "decoded" affordance), never presented as ground truth the chain asserted.

Beside the headline sits a row of **readings** — the instrument gauges. Each is a labeled value; values that the source doesn't provide render as an em-dash (`—`) rather than a zero or a guess.

| Reading | Source | Notes |
| --- | --- | --- |
| Fee | `get_transaction.fee`, else `Σ inputs.capacity − Σ outputs.capacity` | The RPC `fee` field is populated for pool txs but is typically `null` once committed, so compute it from resolved inputs. Shown in CKB. If inputs are unresolved (§9.7 partial), fee reads `—` until they resolve. |
| Size | serialized tx byte length | Computed from the molecule-encoded transaction; the node does not return a size field. Bytes / KB. |
| Cycles | `get_transaction.cycles` | Nullable — present mainly for pool txs. Render only when present; `—` otherwise. |
| Inputs | `inputs.length` | Count. |
| Outputs | `outputs.length` | Count. |
| Block | `tx_status.block_number` | Only populated when `status == committed`. |
| Timestamp | header of `tx_status.block_hash` | Requires a follow-up `get_header(block_hash)` read; wall-clock from the header `timestamp` (unix ms). |
| Status | `tx_status.status` | One of `pending`, `proposed`, `committed`, `unknown`, `rejected` — rendered as a status dot plus the word. |

Status drives what the banner can show: `committed` gives block and timestamp; `pending`/`proposed` show "in the pool, not yet committed" with block and timestamp reading `—`; `unknown` and `rejected` never reach the banner — they are error states (§9.7). The banner is present at every non-error state, showing skeleton readings while loading.

### 9.2 The flow

The centerpiece and the thing the tool is remembered by. Three regions across the viewport: the **input column** on the left, the **transaction spine** down the center, the **output column** on the right. Cells hang off each column; connectors join every cell to the spine.

**Layout.** Inputs and outputs are laid out as DOM cell cards in two CSS grid/flex columns. The spine is a single vertical element centered between them, tall enough to span both columns. This is a hand-built HTML + SVG-overlay layout, not a generic node-graph canvas: the cards are styled DOM, and one absolutely-positioned SVG overlays the whole flow to draw connectors. The SVG has `pointer-events: none` so it never eats card interactions; individual connector `<path>`s opt back in with `pointer-events: auto` for hover.

**Connector geometry.** After layout, each cell exposes a connector *anchor* on its inner edge — the right-middle point of an input card, the left-middle of an output card. Measure every anchor and the spine's attachment points with `getBoundingClientRect()` relative to the flow container, in a `useLayoutEffect`, and recompute on a `ResizeObserver` over the container and on scroll. Each connector is a single cubic Bézier drawn with horizontal tangents at both ends, so it leaves the cell and meets the spine flat:

```
// input cell anchor (x1,y1) → spine left attach (x2,y2)
k = max(24, 0.45 * (x2 - x1))          // horizontal handle length
d = `M ${x1} ${y1} C ${x1+k} ${y1}, ${x2-k} ${y2}, ${x2} ${y2}`
```

The output side mirrors it: spine right attach `(x1,y1)` → output cell anchor `(x2,y2)`, same formula. Spine attach points `y2` are distributed along the spine's height in cell order, so connectors fan out without crossing more than they must. The handle length `k` is proportional to the horizontal gap with a floor, which keeps the S-curve graceful at both wide desktop and narrow layouts.

**The cell-deps lane.** Cell deps are drawn in a distinct lane feeding the spine — visually separated and styled to read as **read-not-consumed** (thinner, dashed, or lower-emphasis strokes per §10; the *behavior* is that they enter the spine but carry no capacity and are excluded from the balance math). They connect from a compact lane (a strip of small dep chips, typically above or beneath the input column) into the spine with the same Bézier geometry but the distinct dep style. Because dep chips are frequently the same few system scripts repeated, the lane collapses by default (see §9.6) and expands on demand.

**Capacity totals anchor each side.** The foot of the input column shows `Σ inputs.capacity`; the foot of the output column shows `Σ outputs.capacity`; the fee is shown between them, on or beside the spine, as the literal difference `Σin − Σout`. This is the whole point of the spatial layout — the fee is not a number you look up, it is the gap between the two totals made visible. All three update as inputs resolve.

**Hover and focus highlighting.** Hovering a cell sets an active cell id in UI state. The active cell's connector(s) brighten and raise (re-order the path to the end of the SVG so it paints on top), and every other connector and card dims via a class toggled at the SVG-group and column level — no per-frame React re-render of the graph, just a class flip. Hovering a connector highlights the same way. **Keyboard focus is the exact equivalent**: cells are focusable (Tab order runs inputs → spine → outputs; Arrow keys move within a column, Left/Right jump columns), and a focused cell produces the identical highlight-and-dim as hover, so a keyboard user gets the same "which flows are this cell's" reading. Focus is always visibly ringed (§10 quality floor). Enter/Space on a focused cell opens the detail panel, the keyboard equivalent of a click.

### 9.3 Cell card anatomy

Every input and output renders as the same card so the two columns read as one vocabulary. The card is dense but legible; it is the unit the whole flow is built from.

- **Capacity, prominent.** The largest reading on the card, in CKB with tabular figures. Held internally as `bigint` shannons, formatted at the render edge (`1 CKB = 1e8 shannon`).
- **Lock and type tags.** Two labeled tags — lock always, type only when the cell has one. Each tag shows the **decoded name** from the registry ("Secp256k1 sighash", "xUDT", "Nervos DAO") tinted by **category** (lock vs type get distinct tints; §10 owns the exact hues). A cell with no type script simply omits the type tag.
- **Data indicator.** A compact signal of whether the cell carries data and how much — a "has-data" marker plus a size ("312 B", "1.2 KB"), or a quiet "no data" when `outputs_data[i]` is empty (`0x`). This is the cheap tell that a cell is an asset/state cell versus a plain capacity cell.
- **OutPoint / index, truncated and copyable.** An output shows its index within this transaction (`#0`, `#1`, …). An input shows its `previous_output` as a truncated `0xabcd…1234:2` (tx hash middle-elided, colon, index). Both are copyable — clicking the affordance copies the *full* value, not the truncation.
- **Unknown-script state.** When a card's lock or type code hash matches no registry entry, that tag renders **neutral and explicitly marked unrecognized** — a shortened code hash, never a guessed name. This is a first-class state, not an error.

Card states, all of which must be visually distinct: **default**, **hover** (highlight-and-raise its connectors, per §9.2), **focus** (identical to hover, plus a visible focus ring), **selected** (the card whose detail panel is open — a persistent selected treatment that outlives hover), and **unknown-script** (the neutral/unrecognized treatment above, which composes with the other four).

### 9.4 Detail panel

Opened by clicking or keyboard-activating a cell; layered over the main view (a side panel or sheet, not a route change) so the flow stays in context behind it. It is the full, exact truth of one cell — where the flow is legibility, the panel is completeness.

- **Capacity, exact and occupied.** The exact `capacity` in shannons and CKB, and the **occupied capacity** — the bytes the cell actually uses — shown against the total so the free headroom reads directly, e.g. "occupies 61 of 100 CKB — 39 CKB free". Occupied bytes are the raw field sum `8 (capacity) + 32 (code_hash) + 1 (hash_type) + len(args)` per script `+ len(data)` (a type script contributes 0 when absent) — **not** the molecule-serialized size with headers and offsets. The default-lock, no-type, no-data minimum is exactly 61 bytes → 61 CKB.
- **Lock and type scripts, fully.** For each script: `code_hash`, `hash_type` (`data` / `type` / `data1` / `data2`), and `args`, each shown raw and copyable, with the decoded registry name and category where known. An address rendering of the lock (RFC0021 full bech32m, `ckb`/`ckt` HRP) is offered alongside the raw script.
- **Raw data + decoded view.** The raw `outputs_data[i]` hex, plus a decoded view where the type script is known — UDT amount (leading 16 bytes, little-endian `u128`), a DAO deposit/withdraw read of the 8-byte data, `SporeData` fields (`content_type`, `content`, `cluster_id`), and so on per §8. On-chain data is attacker-controlled: it is always rendered as text, never injected as HTML.
- **Decoded meaning, in words.** A one-line plain-language statement of what this specific cell is ("Holds 1,500 USDC (xUDT); owner lock hash `0x…`"), labeled inferred.
- **Copy everything.** Every hash, the full OutPoint, the args, the address, and the raw data are individually copyable; a "copy all as JSON" affordance dumps the normalized cell.
- **Link to script explanation.** Registry scripts link to a short explanation of what that script does and how to read its args — the bridge from "this is xUDT" to "here is what xUDT means."

### 9.5 Lineage view

The trace feature, and the reason the tool turns a single transaction into a navigable history. It renders in the same flow layout as the main view — stepping lineage swaps the rendered transaction, it does not open a different kind of screen.

- **Backward, from an input.** Every input names its source by `previous_output = { tx_hash, index }`. Following an input backward loads `get_transaction(previous_output.tx_hash)` and renders *that* transaction in the flow, with the originating output highlighted. Backward lineage is always available from node data alone — it is an O(1) hop — so it is the primary, always-on direction.
- **Forward, from an output.** A node cannot look forward: nothing in the chain RPC maps an OutPoint to its consuming transaction. Forward lineage therefore requires the indexer (query `get_transactions` by the cell's lock/type script, keep `io_type == "input"` rows, then match `inputs[io_index].previous_output` to this OutPoint) or the explorer API (`display_outputs[index].consumed_tx_hash` in one call). When neither is configured, or the output is still live (unspent), the forward affordance is **disabled with a plain reason**, never a dead link (§9.7).
- **Breadcrumb path.** A breadcrumb records the walk — the chain of transactions the user stepped through — so they can see where they are, step back to any prior transaction, and understand the path as a history rather than a set of disconnected loads. Each crumb is the truncated tx hash with its decoded headline on hover. Stepping back is a crossfade to the same flow rendering (§10 motion).

### 9.6 Interactions

The complete interaction set across all surfaces:

- **Load** a transaction by pasting a valid hash and pressing Enter / the load control, or by **picking an example** from the menu.
- **Switch network** (mainnet/testnet), which re-resolves the current hash against that network's endpoint and registry.
- **Hover a cell** to highlight its connectors and dim the rest; **hover a connector** for the same effect.
- **Focus a cell** by keyboard (Tab / Arrow keys) for the identical highlight; **Enter/Space** opens its detail.
- **Click a cell** to open the **detail panel**; dismiss with Escape, a close control, or clicking outside.
- **Trace lineage** — from an input, step **backward** to its creating transaction; from an output, step **forward** to its consuming transaction when available.
- **Step back** along the lineage breadcrumb to any earlier transaction.
- **Copy** any hash, OutPoint, args, address, or raw data — each copies its full value.
- **Collapse / expand** the cell-deps lane and the witnesses list, which are noise for most reads and detail for some; collapsed by default.
- **Expand grouped cell runs** in large transactions (§9.8).
- **Retry** from any error state, and **paste your own endpoint** when the default is blocked.

### 9.7 States

Every surface accounts for the full lifecycle, in plain language, per the quality floor.

- **Empty.** No hash loaded. The input bar and example menu are prominent; the flow area invites a hash or an example. No spinner, no fake skeleton — a clear starting state.
- **Loading.** A skeleton, not a spinner: skeleton readings in the banner and skeleton cards in both columns, sized to the eventual layout so the view doesn't jump when data lands. Because inputs resolve as a second wave of reads, the outputs and spine can render before the inputs finish (see partial).
- **Error**, each with a specific plain-language message and a next action:
  - **Bad hash** — caught at validation before any request: "A transaction hash is `0x` followed by 64 hex characters."
  - **Transaction not found** — `tx_status.status == unknown`: "No transaction with this hash on {network}. Check the hash, or try the other network." (Offer the network switch inline.)
  - **Rejected** — `status == rejected`: show the `reason` from `tx_status`, plainly, as the transaction's terminal state.
  - **Endpoint / CORS failure** — the request never resolved (network error, blocked cross-origin, endpoint down): "Couldn't reach the {network} endpoint. It may be down or blocking browser requests — paste your own endpoint to continue." with the endpoint field surfaced. This is the expected failure for a browser app pointed at a non-CORS node; say so, don't blame the user.
  - **Forward-lineage unavailable** — no indexer/explorer configured, or the output is unspent: the forward trace affordance is disabled with "Forward lineage needs an indexer or the explorer API" or "This output is unspent — nothing consumes it yet." Backward lineage stays fully available; the feature degrades, it does not break.
- **Partial (inputs unresolved).** The transaction loaded but some `previous_output` cells haven't resolved yet (still fetching) or **can't** resolve (the source is node-only and the input cell is already spent, so `get_live_cell` returns `unknown` and the `get_transaction` fallback is what fills it). Unresolved inputs render as cards that show the OutPoint and a "resolving…" or, if terminal, an "unresolved cell" marker — the flow is still drawn, connectors still land, but that card's capacity, scripts, and data read `—` until resolved. Any total that depends on inputs (the input sum and therefore the fee) reads `—` until every input is in, then fills. This state is normal and must never block the rest of the view.

### 9.8 Large transactions

This resolves the open question of §15. A CKB transaction can carry hundreds of inputs and outputs (batched transfers, aggregators, DAO sweeps); the flow must stay legible and stay fast without abandoning the connector metaphor.

**Two thresholds, grouping before virtualization.** Grouping is the first line of defense because it *aids* legibility, and it sidesteps the hard problem — connectors to off-screen rows — that virtualization creates.

| Column size | Treatment |
| --- | --- |
| ≤ ~24 cells | Render every cell individually; every connector drawn. The common case. |
| ~24 – ~150 cells | **Group identical-script runs.** Collapse consecutive cells that share the same (lock, type) decoded identity into one grouped card ("18 cells · Secp256k1 sighash · Σ 1,240 CKB"), which expands in place on click/Enter. Ungrouped cells (anything not part of a run) render normally. This turns a wall of identical change outputs into a few meaningful rows. |
| > ~150 cells | **Virtualize the column** with `@tanstack/react-virtual` on top of grouping. Only mounted rows draw real connectors; connectors for off-screen cells **stub at the column edge** (a short stub into the spine) rather than tracking an unmounted anchor, and resolve to full curves as the user scrolls them into view. |

The thresholds are tuning values, not law — pick the exact numbers against the real render budget on a mid-range machine, but keep the *shape*: individual → grouped → virtualized, with grouping doing most of the work.

**What the grouped view looks like.** A grouped card occupies one card slot and reads as a summary of its run: the count, the shared decoded script name and category tint, and the summed capacity of the run (so the capacity totals still reconcile — a group contributes its sum to the column total exactly as its members would). Its connector to the spine is a single **bundled** connector representing the whole run, styled a touch heavier to signal it stands for many. Expanding a group replaces the summary card with its member cards inline and fans their individual connectors; collapsing bundles them back. Grouping only ever merges cells that are genuinely identical in decoded script identity — it never merges cells that differ in lock, type, or known-ness, because that would hide exactly the distinctions the tool exists to show. Data-carrying cells (has-data) are excluded from grouping and always render individually, since their data is the point.

Decoding and molecule parsing for grouped and off-screen cells is **lazy** — a collapsed group decodes only its shared script identity and summed capacity up front, deferring per-cell data decode until a member is expanded or scrolled into view — and every per-cell decode is memoized so scrolling a virtualized column never re-parses a cell twice.

## 10. Design system

The visualizer is a reading instrument, not a dashboard. Every token below serves one goal: make a transaction's structure legible at a glance and its capacity flow unmistakable. The aesthetic is a dark furnace panel — warm near-black metal, hairline seams, tabular readouts, and a single ember that marks where value moves. There is exactly one accent. Everything else is neutral, and hierarchy is carried by lightness, weight, and letter-spacing, never by color noise.

All values are given as CSS custom properties so the SVG connector layer and the DOM cell layer draw from one source of truth. Ship them as `:root` variables.

### 10.1 Color

The palette is **dark-only**. There is no light theme; a furnace instrument is a dark object. Elevation is expressed by *lightness plus a hairline border* — a panel is lighter than the surface behind it and sealed with a 1px seam. **Never use drop shadows, blurs, or glows.** A glow would read as a bloom artifact and break the flat-instrument feel; the ember accent supplies all the "heat" the interface needs.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0F0C0A` | Page surface. Warm near-black (a red-shifted graphite, not neutral gray). Base elevation 0. |
| `--panel` | `#17120E` | Transaction frame, cell cards, toolbars. Elevation 1 — one step lighter than `--bg`. |
| `--panel-raised` | `#1E1813` | Hover/selected cell, popovers, the active lineage frame. Elevation 2. |
| `--well` | `#0A0807` | Recessed containers: raw `data` hex, witness blobs, code/args readouts. Darker than `--bg` to read as inset. |
| `--border` | `#2A2320` | Hairline seam. The default 1px border on every panel, cell, and divider. |
| `--border-strong` | `#3A302A` | Hairline for focused/selected elements and column rules. |
| `--text-primary` | `#F2EBE4` | Warm off-white. Capacities, hashes, primary labels. |
| `--text-secondary` | `#B8AEA5` | Field values, addresses, secondary lines. |
| `--text-muted` | `#7C726A` | De-emphasized meta, uppercase labels, units, placeholder/empty states. |
| `--ember` | `#FF6A2C` | **The single accent.** Active connector, selected-cell rule, current lineage, primary action. |
| `--ember-hover` | `#FF7E45` | Ember on hover — brighter, applied instantly. |
| `--ember-active` | `#E0530F` | Ember pressed / committed-focus. |
| `--ember-dim` | `#5A3B2E` | Resting connector stroke — ember drained of chroma to ~30% presence. |
| `--ember-ink` | `#1A0E07` | Text/icon color placed *on* an ember fill (buttons). |
| `--tint-input` | `#12161A` | Input-side wash. A cool steel overlay on `--panel` for the left (consumed) column. Raw material, fed cold. |
| `--tint-output` | `#1A1410` | Output-side wash. A warm overlay on `--panel` for the right (created) column. Forged, ember-adjacent. |

**Known-script category colors.** Script identity (resolved against the KnownScript table in §7) is signaled by a left-edge rule and a small chip on each cell — never by tinting text. These are graphical marks, held at a common muted lightness so they read as one family rather than a highlighter box. Match a cell's lock/type `code_hash`+`hash_type` to a category; fall back to `--script-unknown` when unresolved.

| Token | Value | Category |
|---|---|---|
| `--script-secp256k1` | `#5B8AA6` | Default lock (`secp256k1_blake160_sighash_all`), multisig |
| `--script-account` | `#4FA391` | Account-abstraction locks: Anyone-Can-Pay, Omnilock, JoyID |
| `--script-dao` | `#C9A24B` | Nervos DAO type |
| `--script-udt` | `#6FAE5A` | sUDT / xUDT type |
| `--script-spore` | `#C56B98` | Spore / Cluster / DOB type |
| `--script-typeid` | `#7E8A99` | TYPE_ID and Unique/type-info |
| `--script-unknown` | `#6B655F` | **Unknown-neutral.** Unrecognized `code_hash`. Deliberately the dullest chip so custom scripts recede, not shout. |

**Status colors.** Transaction `tx_status` and cell live/spent state (§5). Status appears only as a labeled dot and, for `rejected`, a hairline rule — it is the one place a non-ember hue may touch text-adjacent UI.

| Token | Value | Status |
|---|---|---|
| `--status-committed` | `#5F9E6A` | `committed` (on-chain) / live cell |
| `--status-proposed` | `#5B8AA6` | `proposed` |
| `--status-pending` | `#C9A24B` | `pending` |
| `--status-rejected` | `#D6564B` | `rejected` |
| `--status-unknown` | `#6B655F` | `unknown` / spent (`get_live_cell` → not live) |

**Contrast targets (WCAG AA).** Body and value text must clear **4.5:1**; large text (≥18.66px bold / ≥24px), uppercase meta labels, chips, dots, borders, and connector strokes must clear **3:1**. Verified against `--bg` (`#0F0C0A`, L≈0.0039):

- `--text-primary` → **16.5:1** (well past AAA)
- `--text-secondary` → **8.9:1** (AAA)
- `--text-muted` → **4.1:1** — clears the 3:1 graphical/large bar; restrict it to uppercase labels, units, and de-emphasized meta, never body prose.
- `--ember` → **6.8:1** (usable as text as well as stroke)

Every category and status hue sits between 3.2:1 and 5:1 on `--panel`; treat them as graphical marks (dots, chips, rules) and pair them with a text label so meaning never rests on color alone.

### 10.2 Typography

Two families, sharply divided by role:

- **Mono** — `"Berkeley Mono", "JetBrains Mono", ui-monospace, monospace`, always with `font-variant-numeric: tabular-nums`. Carries everything that is *data*: capacities, shannon/CKB units, hashes, `args`, `code_hash`, indices, block numbers, `since` values, and every uppercase meta label. Tabular figures keep capacity columns aligned so the eye reads flow vertically.
- **Sans** — `"Inter", ui-sans-serif, system-ui, sans-serif`, tuned tight (`letter-spacing: -0.01em` at title sizes). Used only for titles, the transaction summary line, and human prose (script category names, status words).

**Type scale** (px / line-height / family):

| Token | Size / LH | Family | Use |
|---|---|---|---|
| `--type-capacity` | 22 / 1.1 | mono | **Capacity — the largest type on any cell.** It is the headline. |
| `--type-title` | 16 / 1.25 | sans | Transaction frame title, panel headers |
| `--type-value` | 13 / 1.45 | mono | Hashes, addresses, args, field values |
| `--type-body` | 13 / 1.5 | sans | Prose, category names, tooltips |
| `--type-caption` | 12 / 1.4 | mono | Units, indices, secondary meta |
| `--type-label` | 11 / 1.3 | mono | Meta labels — `UPPERCASE`, `letter-spacing: 0.09em`, `--text-muted` |

**Rules.** Every meta label (`LOCK`, `TYPE`, `CAPACITY`, `DATA`, `SINCE`, `OUTPOINT`) is uppercase mono at `--type-label` with wide tracking — this is the instrument-panel signature and the primary way labels recede beneath their values. Capacity is rendered as `61.00 CKB` in `--type-capacity` `--text-primary`, with the `CKB` unit set one step down (`--type-caption`, `--text-muted`) and baseline-aligned; the shannon figure lives in the tooltip. Hashes are truncated middle (`0x9bd7…3cce8`) in mono `--type-value` and never wrap.

### 10.3 Spacing, borders, radius

**Radius is zero everywhere.** Cells, panels, chips, buttons, inputs, and wells all have `border-radius: 0`. The *only* rounded elements in the entire interface are status dots, which are full circles (`--radius-dot: 50%`). This is non-negotiable — the squared corner is half of what makes the tool recognizable.

**Borders are hairlines.** Every seam is `1px solid --border` (or `--border-strong` when focused/selected). Elevation is lightness first, hairline second; a raised element is `--panel-raised` sealed with a `--border-strong` edge. No border is ever thicker than 1px except the connector-anchored left rule on a cell (2px, in the script-category color).

**Spacing scale** — 4px base, used for all padding, gaps, and column gutters:

| Token | px |
|---|---|
| `--space-1` | 2 |
| `--space-2` | 4 |
| `--space-3` | 8 |
| `--space-4` | 12 |
| `--space-5` | 16 |
| `--space-6` | 24 |
| `--space-7` | 32 |
| `--space-8` | 48 |

Cell internal padding is `--space-4`; the gutter between the input and output columns (the connector field) is `--space-8` minimum so connectors have room to curve. Vertical gap between stacked cells is `--space-3`.

### 10.4 Motion

Motion is used sparingly and only to explain structure — connectors resolving, one element brightening, one lineage swapping for another. Nothing bounces, nothing floats.

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Connectors drawing in on load | 420ms | `cubic-bezier(0.22, 0.61, 0.36, 1)` (ease-out) | `stroke-dashoffset` from full length → 0. Stagger successive connectors by **24ms** so the transaction "wires up" left-to-right. Cap total stagger at ~360ms regardless of connector count. |
| Hover brighten | **instant** (0ms; ≤80ms max) | none / linear | Stroke and cell brighten immediately on `mouseenter`. Highlight must feel like a physical switch, not a fade. |
| Lineage crossfade | 180ms | `cubic-bezier(0.4, 0, 0.2, 1)` | When the selected cell changes, the previous lineage's ember fades to `--ember-dim` while the new one fades up. Opacity only — no position animation. |
| Panel/detail expand | 160ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Height/opacity for expanding a cell's data or dep detail. |

**`prefers-reduced-motion: reduce`:** connectors render at their final state with no draw-in and no stagger; the lineage crossfade collapses to an instant swap (or ≤80ms opacity); expand/collapse becomes instant. Hover brighten is already instant, so it is unaffected. No parallax, no auto-playing motion exists to suppress.

### 10.5 The signature connector treatment

The connectors are the element the tool is remembered by. They are the forge's tapping streams — thin channels carrying capacity from consumed cells on the left to created cells on the right, glowing only where you are looking.

**Geometry.** Each connector is a single cubic-bezier SVG `<path>` drawn in one absolutely-positioned overlay above the DOM cell layer (per §11's HTML + SVG-overlay approach). Endpoints are measured from each cell's *capacity anchor* (below) via `getBoundingClientRect`. Control points are horizontal, offset by 45% of the gutter width: `M x1 y1 C x1+dx y1, x2−dx y2, x2 y2`. Horizontal tangents at both ends make the stream enter and leave each cell flat against its edge, like a pipe union.

**Resting state.** Stroke `--ember-dim` (`#5A3B2E`), width **1.5px**, `stroke-linecap: round`. Drained of chroma, the resting web reads as cold plumbing — present, structural, but quiet. Every connector at rest sits at this one weight so the transaction's shape is fully visible before any interaction.

**Active / hovered state (the ember spine).** On cell hover or selection, the connectors on that cell's lineage brighten *instantly* to a two-part stroke: a **2.5px** `--ember` (`#FF6A2C`) channel with a **1px** `--ember-hover` (`#FF7E45`) core drawn on top along the identical path — the *ember spine*, a bright filament running down the center of the hot stream. The active path is re-appended to the end of the SVG so it paints above all resting connectors; every non-lineage connector drops to `opacity: 0.35`. This is the signature moment: point at a cell and its exact contribution to the transaction lights up as a single glowing line, everything else receding to cold iron.

**Capacity anchors.** Where a connector meets a cell it terminates in a **6px filled square** (0 radius, matching the squared language), tinted `--tint-input` steel on the consumed side and `--ember` on the created side. The anchor aligns vertically to the cell's capacity readout — the connector visibly springs from the number it represents. Stroke width may optionally encode magnitude: clamp width to `1.5px + log-scaled(capacity)` within a narrow **1.5–3px** band so a 61 CKB cell and a 10,000 CKB cell differ perceptibly without any stream dominating. Keep it subtle; the ember spine, not raw thickness, is what carries attention.

### 10.6 Iconography and misc.

- **Icons:** a single thin line-icon set, **1.5px stroke, 16px grid, square/butt caps, 0 corner radius**, drawn in `--text-muted` and brightening to `--text-primary` or `--ember` on interaction. Icons are sparse — used for dep type (`code` vs `dep_group`), lock/type disclosure, external-link to explorer, and copy-to-clipboard. No filled icons, no duotone, no rounded icon sets; they would fight the hairline instrument language.
- **Status dots:** the sole rounded shape. An 8px circle in the matching `--status-*` color, always paired with an uppercase mono label (`COMMITTED`, `PENDING`). Never a bare dot.
- **Chips:** script-category chips are squared, `--panel-raised` fill, 1px `--border` seam, `--type-label` text, with a 2px left rule in the category color. They label lock/type identity without a colored background bleeding into the cell.
- **Focus rings:** `1px --border-strong` inset plus a `1px --ember` outer hairline offset by 2px — a squared double-seam, never a soft glow, and always meeting the 3:1 non-text contrast bar.
- **Empty / loading:** wells (`--well`) with a `--text-muted` uppercase label (`NO TYPE SCRIPT`, `EMPTY DATA`, `LOADING…`). Loading uses a static hairline scanline at 1px, not a spinner, to stay within the reduced-motion contract.
- **Selection:** a selected cell moves to `--panel-raised`, gains a `--border-strong` seam and an `--ember` left rule, and promotes its lineage connectors — no scale transform, no shadow.

## 11. Architecture and tech stack

ckb-viz is a read-only, single-page browser app. It has no backend of its own beyond an optional thin proxy, no database, and no wallet. That shape decides almost every technical choice: the app is a pure function from a transaction hash to a rendered flow, and everything in the stack should serve legibility, small bundles, and correct handling of immutable on-chain data.

### 11.1 Recommended stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | React 18 + Vite + TypeScript (strict) | Vite gives instant HMR and small tree-shaken production bundles; strict TS lets the app lean on CCC's typed entities and the §5 data model as the shared contract. |
| CKB library | `@ckb-ccc/core` (headless), `@ckb-ccc/spore` for Spore/DOB | Officially recommended, actively maintained (last push 2026-07-09) successor to Lumos. Bundles the JSON-RPC client, molecule codec, Script/Address parsing, a `KnownScript` label registry, and per-network `ScriptInfo` — all in one dependency. See §11.2. |
| Server-state / RPC cache | TanStack Query (`@tanstack/react-query`) | A confirmed transaction is immutable, which makes caching trivially correct: key by hash/OutPoint, set `staleTime: Infinity` and a long `gcTime`. See §11.3. |
| UI state | Zustand (or plain React context) | Selected/hovered cell id, network toggle, expand/collapse, lineage breadcrumb. Small, synchronous, no server data. Do not reach for Redux. |
| Styling | Tailwind CSS with CSS variables for theme tokens | Fastest path to the many small consistent cell "chips"; the dark, low-chroma, squared-corner instrument look from §10 maps directly to a Tailwind theme (`rounded-none`, `tabular-nums`, hairline 1px borders). The SVG connector strokes read the same CSS variables as the DOM cards so DOM and canvas never drift. |
| Molecule / codec | `ccc.mol` (built into `@ckb-ccc/core`) | No separate molecule library. Predefined codecs for every core type plus `WitnessArgs`; `@ckb-ccc/spore` adds `SporeData`/`ClusterData`. See §11.4. |
| Flow rendering | Hand-rolled HTML cards + single SVG connector overlay | The bespoke instrument aesthetic wants full styling control; React Flow's `nodes[]/edges[]` + absolute positioning fights custom cards and a strict two-column layout. Reserve React Flow for a possible later free-pan graph explorer. See §12 `FlowCanvas`. |
| Large-transaction handling | Group-and-expand first; `@tanstack/react-virtual` only if forced | Virtualization conflicts with drawing connectors to off-screen rows, so collapsing `>N` inputs/outputs behind an expander is the first line of defense. |

**Bundle-size note.** `@ckb-ccc/core` pulls in crypto, bignum, and molecule but no wallet-connector UI, so it stays reasonable; explicitly avoid `@ckb-ccc/connector` / `@ckb-ccc/connector-react` (wallet UI, heavier) — a viewer never connects a wallet. Import from `@ckb-ccc/core` rather than a broader barrel to keep tree-shaking effective. The exact minified+gzip size of `@ckb-ccc/core` is unmeasured here; confirm with a bundle analyzer before committing to a size budget.

**CORS note.** The public node endpoints (`https://mainnet.ckb.dev/`, `https://testnet.ckb.dev/`) return `access-control-allow-origin: *` (verified live), so the browser calls them **directly with no proxy** — including the built-in indexer methods (`get_cells`, `get_transactions`) served on the same URL. The **Nervos Explorer REST API is CORS-allowlisted** (only `explorer.nervos.org`-style origins get an ACAO header) and returns `415` without `Content-Type: application/vnd.api+json`, so any use of it from an arbitrary origin **requires a server-side proxy**. The architecture therefore prefers the proxy-free indexer path for forward lineage and treats the explorer as an optional, proxied enhancement (§11.6, §12 `SourceAdapter`).

### 11.2 CKB library: CCC over Lumos

Use CCC. Lumos is in maintenance mode and its own README points developers at CCC. For a read-only viewer install only the headless `@ckb-ccc/core` — the React/wallet/connector packages are unnecessary. CCC gives, in one package, exactly the read surface ckb-viz needs:

- **Client:** `ccc.ClientPublicMainnet({ url })` and `ccc.ClientPublicTestnet({ url })`, both extending `ClientJsonRpc`. Read methods used here: `getTransaction`, `getCellLive(outPoint, withData?, includeTxPool?)`, `getHeaderByHash`, `getTipHeader`, and the built-in-indexer generators `findTransactionsByLock` / `findTransactionsByType` (with a `groupByTransaction` option). The default URL is `wss://mainnet.ckb.dev/ws` (falling back to `https://mainnet.ckb.dev/`) and is overridable via the `url` config in one line.
- **Codec:** `ccc.mol` with `.encode()` / `.decode()` (note: CCC uses `encode/decode`, Lumos used `pack/unpack`).
- **Known-script registry:** the `KnownScript` enum (`Secp256k1Blake160`, `Secp256k1Multisig`, `AnyoneCanPay`, `OmniLock`, `JoyId`, `SUdt`, `XUdt`, `NervosDao`, `TypeId`, `UniqueType`, …) plus per-network `ScriptInfo { codeHash, hashType, cellDeps }`. This seeds the §7 registry so canonical hashes are not hand-copied. Spore/Cluster are **not** in `KnownScript`; they live in `@ckb-ccc/spore`.
- **Camel-case entities:** RPC is snake_case (`code_hash`, `tx_hash`, `previous_output`, `outputs_data`), but CCC hands back camel-cased entities (`codeHash`, `txHash`, `previousOutput`, `outputsData`). The normalizer (§12) works against CCC entities, not raw JSON.

Do not add Lumos unless legacy code forces it.

### 11.3 Data fetching and caching

TanStack Query owns all RPC state; UI state stays in Zustand. Because a committed transaction and its cells never change, caching is both cheap and provably correct.

| Query key | Fetches | `staleTime` |
| --- | --- | --- |
| `['tx', network, hash]` | `getTransaction(hash)` → wrapper + `TransactionView` + `tx_status` | `Infinity` once `status === 'committed'`; short (or refetch) while `pending`/`proposed` |
| `['cell', network, txHash, index]` | resolved input cell (see below) | `Infinity` |
| `['header', network, blockHash]` | `getHeaderByHash` for timestamp + height | `Infinity` |
| `['consumer', network, txHash, index]` | forward-lineage lookup (indexer or proxied explorer) | long, but not `Infinity` (a live cell can become spent) |

Only `status === 'committed'` guarantees on-chain inclusion (with `block_hash`); `unknown` means never-seen-or-evicted; `rejected` carries a reason. The query layer surfaces these as typed states (§11.7), it does not paper over them.

### 11.4 Molecule and codec usage

Decode with `ccc.mol` directly — no separate molecule library.

- **Witnesses:** `ccc.WitnessArgs.decode(hex)` → `{ lock?, inputType?, outputType? }`. A witness may also be an arbitrary blob when a script does not use the `WitnessArgs` layout; decoding must fail soft (§11.7 `decode` error) and fall back to showing raw hex.
- **UDT amount (sUDT and plain xUDT alike):** take `data[0..16]` as a little-endian `Uint128`. Only branch on the xUDT flags in the type-script args (`args[0..32]` = owner lock hash, optional 4-byte LE flags at offset 32) when handling extensions/owner-mode.
- **Nervos DAO:** the 8-byte cell data as LE `u64` — `0` = deposit, non-zero = withdrawing (the value is the deposit block height). Confirm the type-script `code_hash` equals the well-known DAO hash first.
- **Spore / Cluster:** `@ckb-ccc/spore`'s `unpackToRawSporeData(bytes)` → `SporeData { contentType, content, clusterId? }`; the Cluster codec for `{ name, description }`. DOB/0 trait rendering (DNA + cluster pattern) is a higher layer out of scope for the first passes; the raw molecule unwrap is what the decoder consumes for metadata.
- **`since`:** split `flags = (since >> 56n) & 0xffn`, `value = since & 0x00ffffffffffffffn`, then label relative/absolute × block/epoch(`E + I/L`)/timestamp; `since === 0n` is "no lock".
- **Addresses:** encode any lock to a ckb2021 address (`payload = 0x00 | code_hash | hash_type | args`, bech32m, HRP `ckb`/`ckt`) via CCC's `Address` helper — never hand-roll the 5-bit conversion.

All raw byte lengths for occupied-capacity math use the plain field sums (`capacity 8 + code_hash 32 + hash_type 1 + args len` per script `+ data len`), **not** the molecule-serialized size with table headers/offsets. Amounts are `bigint` shannons internally, formatted to CKB (÷ `10^8`) only at the render edge.

### 11.5 Module boundaries and data flow

The pipeline is strictly one-directional, matching the CLAUDE.md contract: **source adapter → normalizer → registry → decoder → view.** Each stage has a typed boundary; the pure stages (normalizer, registry lookup, decoder) have no I/O and are unit-tested against the bundled example transactions.

```
  hash / OutPoint
        │
        ▼
┌─────────────────┐   raw CCC entities (ClientTransactionResponse,
│  SourceAdapter  │   Cell, HeaderView) + forward-lineage lookups
│  (I/O boundary) │   node RPC · built-in indexer · [proxied explorer]
└───────┬─────────┘
        ▼
┌─────────────────┐   §5 Transaction / Input / Cell / Script / CellDep
│   Normalizer    │   snake→shape-normalized, shannons as bigint,
│    (pure)       │   inputs' previous outputs resolved & attached
└───────┬─────────┘
        ▼
┌─────────────────┐   Script.known?  attached by (codeHash, hashType)
│  ScriptRegistry │   lookup, per network; unknown = clearly unrecognized
│    (pure)       │
└───────┬─────────┘
        ▼
┌─────────────────┐   plain-language summary + per-cell meaning,
│ TransactionDec. │   always labeled inferred; UDT/DAO/Spore classified
│    (pure)       │   by type-script code_hash, not heuristics
└───────┬─────────┘
        ▼
┌─────────────────┐   FlowCanvas · CellCard · DetailPanel · LineageView
│      View       │   SummaryBanner · InputBar
│  (React + SVG)  │
└─────────────────┘
```

The rule the boundary enforces: the view never sees a raw RPC response, and the pure stages never perform I/O. Anything that needs the chain goes through `SourceAdapter`; anything that needs the DOM lives in the view. This is what lets a node, an indexer, or the explorer API back the app without touching the rest of it, and it is what makes the decode logic testable in isolation.

### 11.6 Project structure

```
ckb-viz/
├─ index.html
├─ vite.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ public/
│  └─ examples/                 # bundled example txs, one per decode category
│     ├─ ckb-transfer.json
│     ├─ udt-transfer.json
│     ├─ dao-deposit.json
│     └─ spore-mint.json
├─ src/
│  ├─ main.tsx                  # React root, QueryClientProvider
│  ├─ App.tsx                   # layout: InputBar / SummaryBanner / FlowCanvas
│  ├─ config/
│  │  ├─ networks.ts            # mainnet|testnet endpoints, HRP, explorer base
│  │  └─ env.ts                 # reads import.meta.env, validates overrides
│  ├─ source/                   # ── I/O boundary ──
│  │  ├─ SourceAdapter.ts       # interface + default composite impl
│  │  ├─ nodeSource.ts          # CCC client: tx + input resolution + backward
│  │  ├─ indexerSource.ts       # findTransactionsByLock/Type → forward lineage
│  │  └─ explorerSource.ts      # optional, proxied; display_outputs consumer
│  ├─ model/
│  │  ├─ types.ts               # §5 Transaction/Input/Cell/Script/CellDep
│  │  └─ errors.ts              # VizError typed union (§11.7)
│  ├─ normalize/
│  │  └─ normalize.ts           # pure: CCC entities → §5 model
│  ├─ registry/
│  │  ├─ scripts.ts             # per-network seed (from CCC KnownScript + spore)
│  │  └─ lookup.ts              # pure (codeHash, hashType) → KnownScript?
│  ├─ decode/
│  │  ├─ decode.ts              # pure: tx → summary + per-cell meaning
│  │  ├─ udt.ts  dao.ts  spore.ts  since.ts   # per-asset decoders
│  ├─ hooks/
│  │  ├─ useTransaction.ts      # TanStack Query wrapper
│  │  └─ useLineage.ts
│  ├─ state/
│  │  └─ uiStore.ts             # Zustand: selection, hover, network, breadcrumb
│  ├─ components/
│  │  ├─ InputBar.tsx  SummaryBanner.tsx
│  │  ├─ FlowCanvas.tsx  Connectors.tsx
│  │  ├─ CellCard.tsx  ScriptTag.tsx
│  │  ├─ DetailPanel.tsx  LineageView.tsx  Breadcrumb.tsx
│  │  └─ states/                # Empty / Loading / Error / NotFound (§9.7)
│  └─ lib/
│     ├─ format.ts              # shannons→CKB, hash truncation, copy
│     └─ hex.ts
└─ test/
   └─ fixtures → public/examples # golden decode snapshots per category
```

### 11.7 Configuration and environment

Network and endpoints are data, not constants baked into components.

- **Networks** (`config/networks.ts`): `mainnet` and `testnet`, each with a default node URL (`https://mainnet.ckb.dev/`, `https://testnet.ckb.dev/`), address HRP (`ckb`/`ckt`), and an optional explorer proxy base. The active network lives in UI state and drives which registry, client, and endpoint are used; switching network reloads the current view against that network.
- **Overrides** (`config/env.ts`): a power-user settings field maps to CCC's client `url` option so a private or self-hosted node can be pasted in. Any user-supplied endpoint is validated (well-formed URL, http/https) before use — treat it as untrusted input.
- **Explorer proxy** is optional and off by default: `VITE_EXPLORER_PROXY_BASE`. When unset, forward lineage runs proxy-free through the built-in indexer; when set, the app may additionally use the one-shot explorer `consumed_tx_hash` path.
- **No secrets in the client.** There are no keys to ship; the `.env` carries only public endpoint URLs and the optional proxy base. Never commit `.env`.
- **Examples are bundled** (`public/examples/`) so the tool is fully explorable with no endpoint configured — the InputBar can load a category example that flows through the same normalize→decode pipeline as a live fetch.

### 11.8 Error-handling strategy

Every failure is a typed value, not a thrown string, so the view can map it deterministically onto the §9.7 states. The pipeline stages return `Result`-shaped outcomes at their boundaries; only truly exceptional (programmer-error) conditions throw.

```ts
type VizError =
  | { kind: 'invalid-hash';        input: string }                          // pre-fetch validation
  | { kind: 'not-found';           hash: Hex }                              // tx_status = unknown
  | { kind: 'rejected';            hash: Hex; reason: string }              // tx_status = rejected
  | { kind: 'network';             endpoint: string; cause: string }       // fetch/timeout
  | { kind: 'cors';                endpoint: string }                       // browser-blocked origin
  | { kind: 'rpc';                 code: number; message: string }          // JSON-RPC error object
  | { kind: 'decode';              scope: string; field: string; cause: string } // soft: fall back to raw
  | { kind: 'lineage-unavailable'; direction: 'forward';
      reason: 'no-indexer' | 'not-consumed' | 'needs-proxy' };
```

| `VizError.kind` | §9.7 state | User-facing behavior |
| --- | --- | --- |
| `invalid-hash` | Empty / input-error | InputBar shows inline "not a 32-byte transaction hash"; nothing fetched. |
| `not-found` | Not-found | "No node has seen this transaction (unknown)." Offer to retry or switch network. |
| `rejected` | Error | Show the rejection `reason` plainly. |
| `network` / `cors` | Error | "Could not reach `<endpoint>`." Suggest checking the endpoint or configuring a proxy/self-hosted node. |
| `rpc` | Error | Show `code`/`message`; distinguish transient from malformed. |
| `decode` | Loaded (degraded) | The affected cell/witness renders as raw hex, flagged "could not decode"; the rest of the transaction still renders. **Decode never aborts the view.** |
| `lineage-unavailable` | Loaded (lineage disabled) | Forward-trace affordance is shown disabled with a reason ("node-only: forward lineage needs an indexer"), backward lineage still works. |

Two invariants hold across all of it, matching CLAUDE.md: on-chain data is untrusted (decoded data and args are rendered as text, never injected as HTML), and ckb-viz never guesses — an unknown script is a shortened code hash marked unrecognized, and a decode it cannot make is stated plainly rather than invented.

## 12. Component inventory

The build decomposes into ten components across the pipeline and the view. The three pure stages (`Normalizer`, `ScriptRegistry`, `TransactionDecoder`) are plain functions; the adapter is the sole I/O boundary; the remaining six are React components. Types below reference the §5 data model (`Transaction`, `Input`, `Cell`, `Script`, `CellDep`) and the §11.8 `VizError`.

| Component | Layer | Kind | Responsibility (one line) |
| --- | --- | --- | --- |
| `SourceAdapter` | source | interface + impls | Fetch a tx, resolve input cells, and look up forward lineage, behind one interface. |
| `Normalizer` | normalize | pure fn | CCC entities → the §5 `Transaction` shape, shannons as `bigint`. |
| `ScriptRegistry` | registry | pure fn + data | Attach `Script.known` by `(codeHash, hashType)` per network. |
| `TransactionDecoder` | decode | pure fn | Produce the plain-language summary and per-cell meaning, always inferred. |
| `FlowCanvas` | view | React + SVG | The input→spine→output flow with connectors, totals, and hover highlight. |
| `CellCard` | view | React | One cell: capacity, script tags, data indicator, OutPoint, states. |
| `DetailPanel` | view | React | Full cell detail, decoded scripts/data, copy actions. |
| `LineageView` | view | React | Backward/forward tracing with a breadcrumb. |
| `InputBar` | view | React | Hash entry, network selector, example loader. |
| `SummaryBanner` | view | React | The decoded headline plus key readings. |

### 12.1 `SourceAdapter`

- **Responsibility.** The only component that touches the network. Fetches a transaction, resolves each input's previous output to a full cell, fetches block header context, and answers forward-lineage queries — composing node RPC, the built-in indexer, and (optionally, proxied) the explorer behind one interface so the rest of the app is source-agnostic.
- **Interface.**
  ```ts
  interface SourceAdapter {
    getTransaction(hash: Hex): Promise<Result<RawTx, VizError>>;      // CCC ClientTransactionResponse + tx_status
    resolveCell(outPoint: OutPoint): Promise<Result<RawCell, VizError>>;
    getHeader(blockHash: Hex): Promise<Result<RawHeader, VizError>>;
    findConsumer(outPoint: OutPoint, cellScripts: { lock: Script; type?: Script }):
      Promise<Result<Hex | null, VizError>>;                          // null = live/not-consumed
  }
  ```
- **Inputs.** `network`, a resolved node `url` (default or user override), an optional explorer proxy base. Params as above.
- **Outputs / events.** Raw CCC entities wrapped in `Result`; no domain shaping (that is the Normalizer's job).
- **Key behaviors / states.**
  - *Input resolution:* try `getCellLive(outPoint, withData=true)`; if `status !== 'live'` (spent input), fall back to `getTransaction(outPoint.txHash)` and index `outputs[index]` / `outputsData[index]`. This is what makes spent-input detail robust for committed txs.
  - *Forward lineage:* prefer the proxy-free indexer path — `findTransactionsByType`/`findTransactionsByLock(script, { groupByTransaction })`, keep rows where `io_type === 'input'`, then `getTransaction` on each candidate and match `inputs[io_index].previous_output` against the target OutPoint. Use the proxied explorer `display_outputs[index].consumed_tx_hash` only when a proxy base is configured. A node-only deployment returns `{ kind: 'lineage-unavailable', reason: 'no-indexer' }`.
  - *Error mapping:* fetch failure → `network`/`cors`; JSON-RPC `error` object → `rpc`; `tx_status.status` of `unknown` → `not-found`, `rejected` → `rejected`.

### 12.2 `Normalizer`

- **Responsibility.** Pure transform from raw CCC entities to the §5 model. Converts every quantity to `bigint` shannons, pairs `outputs[i]` with `outputsData[i]`, attaches each resolved previous cell to its `Input`, decodes `since`, computes `fee = Σinputs.capacity − Σoutputs.capacity`, and reads block height/timestamp from the header.
- **Signature.** `normalize(raw: RawTx, resolvedInputs: RawCell[], header?: RawHeader): Transaction`
- **Inputs.** The adapter's raw tx, the array of resolved input cells (index-aligned to `inputs`), the optional header.
- **Outputs.** A fully-shaped `Transaction` (§5), with `Input.cell?` populated where resolution succeeded and `undefined` where it failed (so a partially-resolved tx still renders).
- **Key states.** Pure and total — never throws on malformed data; an unresolvable input yields `cell: undefined` rather than an error, and an unparseable `since`/capacity is left raw and flagged for the decoder. No I/O, no DOM. Unit-tested against the bundled examples with golden snapshots.

### 12.3 `ScriptRegistry`

- **Responsibility.** Map a script's `(codeHash, hashType)` to a `KnownScript` — name, category (`lock`|`type`), and interpretation hint — per network, seeded from CCC's `KnownScript`/`ScriptInfo` plus `@ckb-ccc/spore`. Never guesses.
- **Signature.** `lookup(script: Script, network: Network): KnownScript | undefined` where `KnownScript = { name; category: 'lock' | 'type'; meaning: string }`.
- **Inputs.** A §5 `Script`, the active network.
- **Outputs.** The `KnownScript` (assigned to `Script.known`) or `undefined` for an unrecognized script.
- **Key states / rules.** Keyed on the **pair** `(codeHash, hashType)`, not `codeHash` alone — several scripts reuse a hash under different `hashType` (e.g. xUDT is `data1` on mainnet but `type` on testnet; multisig v1 vs v2). Registry entries are reference data verified against the live deployment, not immutable truths. A miss is explicit: the view shows a shortened code hash marked unrecognized. Pure, unit-tested.

### 12.4 `TransactionDecoder`

- **Responsibility.** Turn the normalized, registry-annotated transaction into a one-sentence summary and a per-cell meaning, classifying asset intent by matching type-script `code_hash` against known scripts (not heuristics on data length).
- **Signature.** `decode(tx: Transaction, network: Network): Decoded` where `Decoded = { summary: Summary; cellMeanings: Map<CellRef, CellMeaning> }`, `Summary = { kind: 'ckb-transfer' | 'udt-transfer' | 'dao-deposit' | 'dao-withdraw' | 'spore-mint' | 'spore-transfer' | 'spore-melt' | 'structural'; text: string; inferred: true }`.
- **Inputs.** A decoded `Transaction`, the active network.
- **Outputs.** The summary (headline for `SummaryBanner`) and per-cell meanings (for `CellCard`/`DetailPanel`).
- **Classification rules.**
  - Only default locks, no type scripts → `ckb-transfer`; report amount to non-change outputs and change returned.
  - UDT type on outputs → `udt-transfer`; amount = `data[0..16]` LE `u128`; name the token by type-script args where known.
  - Nervos DAO type in outputs → `dao-deposit`; in inputs → `dao-withdraw`.
  - Spore/Cluster type → mint/transfer/melt by presence in inputs vs outputs vs both.
  - Otherwise → `structural`: "N inputs → M outputs" with the dominant script named, never invented intent.
- **Key states.** Every result carries `inferred: true`; where the decoder cannot tell, it says so rather than guessing. A per-asset `decode` failure degrades that cell to raw, never the whole summary. Pure, snapshot-tested per category.

### 12.5 `FlowCanvas`

- **Responsibility.** The centerpiece. Lay out inputs (left column) and outputs (right column) as `CellCard`s around a central transaction spine, draw curved connectors input→spine and spine→output plus a distinct cell-deps lane, anchor capacity totals on each side so the fee is visible as the difference, and drive hover highlighting.
- **Props.**
  ```ts
  interface FlowCanvasProps {
    tx: Transaction;
    decoded: Decoded;
    selectedId: CellRef | null;
    hoveredId: CellRef | null;
    onSelect(id: CellRef): void;
    onHover(id: CellRef | null): void;
    onTrace(id: CellRef, dir: 'backward' | 'forward'): void;
  }
  ```
- **Outputs / events.** `onSelect` (open DetailPanel), `onHover` (highlight), `onTrace` (into LineageView).
- **Rendering approach.** DOM cards via CSS grid/flex; after layout, measure each card's connector anchor with `getBoundingClientRect()` relative to the container in a `useLayoutEffect`, then render cubic-bézier `<path>`s in one absolutely-positioned `pointer-events:none` SVG overlay (each path `pointer-events:auto` for hover). Recompute on `ResizeObserver` + scroll. The SVG strokes read the same CSS theme variables as the cards.
- **Key states.** Hover raises the active path (reorder to paint on top, thicken/accent) and dims the rest via a group-level opacity class — no per-frame React re-render. Cell-deps lane and witnesses are collapsible. Very large transactions collapse `>N` cells behind an expander before any virtualization is considered. Connectors draw in on load; `prefers-reduced-motion` disables the draw.

### 12.6 `CellCard`

- **Responsibility.** Render one input or output cell as a compact instrument chip: capacity as the largest type, lock and type scripts as labeled `ScriptTag`s with decoded names, a data-present indicator with size, and a truncated, copyable OutPoint or index.
- **Props.**
  ```ts
  interface CellCardProps {
    cell: Cell;                 // §5
    role: 'input' | 'output' | 'cellDep';
    meaning?: CellMeaning;
    selected: boolean;
    hovered: boolean;
    onSelect(): void;
    onHover(hovering: boolean): void;
  }
  ```
- **Outputs / events.** `onSelect`, `onHover`; copy actions on the OutPoint.
- **Key states.** `default | hovered | selected | unresolved` (an input whose previous cell could not be fetched shows the OutPoint reference only), plus `unrecognized-script` styling (neutral, clearly marked) when `cell.lock.known`/`cell.type.known` is absent. Capacity uses `tabular-nums`, formatted shannons→CKB at render. Untrusted `data`/`args` render as text only.

### 12.7 `DetailPanel`

- **Responsibility.** The full read of one selected cell: exact capacity and occupied capacity, lock and type scripts each with code hash / hash type / args, raw data with a decoded view where the script is known, the decoded meaning in words, and the derived address for the lock. Everything hash-like is copyable; registry scripts link to a short explanation.
- **Props.** `{ cell: Cell; meaning?: CellMeaning; network: Network; onClose(): void; onTrace(dir): void }`.
- **Outputs / events.** `onClose`, copy actions, `onTrace` to lineage, optional "explain this script" link.
- **Key states.** `open | closed`; per-field `decoded | raw-fallback` (a field that could not be decoded shows raw hex flagged "could not decode"); `known-script | unrecognized`. Address is rendered via CCC's `Address` helper (bech32m, correct HRP for the network). No HTML injection of on-chain bytes.

### 12.8 `LineageView`

- **Responsibility.** Turn a single transaction into a navigable chain. From an input, follow its OutPoint backward to the creating transaction; from an output, follow it forward to the consuming transaction if one exists; render each hop in the same flow, with a breadcrumb of the path walked.
- **Props.**
  ```ts
  interface LineageViewProps {
    origin: { txHash: Hex; cell: CellRef; dir: 'backward' | 'forward' };
    breadcrumb: LineageStep[];
    onStep(index: number): void;      // jump back along the trail
    onExtend(id: CellRef, dir): void; // trace one more hop
  }
  ```
- **Outputs / events.** `onStep` (breadcrumb navigation), `onExtend` (next hop).
- **Data path.** Backward uses `SourceAdapter.resolveCell` / `getTransaction` (proxy-free, node-only). Forward uses `SourceAdapter.findConsumer`.
- **Key states.** `backward-available` (always, given a node), `forward-available | forward-unavailable` (node-only deployments disable the forward affordance with the reason from `lineage-unavailable`), `not-consumed` (a live output has no consumer — shown as a terminal, not an error). Steps transition with a short crossfade, disabled under reduced motion.

### 12.9 `InputBar`

- **Responsibility.** The entry point: a field to paste a transaction hash, a mainnet/testnet selector, and a small set of example transactions (one per decode category) so every feature is reachable without hunting for a hash.
- **Props.** `{ network: Network; onNetworkChange(n: Network): void; onLoad(hash: Hex): void; onLoadExample(key: ExampleKey): void; status: LoadStatus }`.
- **Outputs / events.** `onLoad` (validated hash), `onLoadExample`, `onNetworkChange`.
- **Key states.** Validates the hash before emitting (`0x` + 64 hex) and shows an inline `invalid-hash` message otherwise; reflects `idle | loading | error` from the query. Switching network reloads the current view against that network's registry and endpoint. Examples load through the same normalize→decode pipeline as live fetches, so they exercise the real path with no endpoint configured.

### 12.10 `SummaryBanner`

- **Responsibility.** The plain-language decode as the headline (e.g. "CKB transfer" or "Token transfer of 1,250 USDX"), with the key readings beside it: fee, size, input count, output count, block, timestamp, status.
- **Props.** `{ summary: Summary; readings: { fee: bigint; size: number; inputs: number; outputs: number; blockNumber?: bigint; timestamp?: number; status: TxStatus } }`.
- **Outputs / events.** None beyond copy on hash-like readings; it is a presentational headline.
- **Key states.** `status` drives a single status dot (the only circle in the design) — `committed | proposed | pending | unknown | rejected`; when the summary `kind` is `structural` the headline is explicitly descriptive rather than intent-claiming; the "inferred" nature of the decode is always signaled. Fee and capacities format shannons→CKB with `tabular-nums`.

## 13. Non-functional requirements

ckb-viz is a read-only single-page app whose whole value is legibility, so its non-functional bar is set by two things: it must feel instant on a transaction a person actually pasted, and it must never betray the calm of the design under load, on a keyboard, or against hostile cell data.

### 13.1 Performance budgets

The app fetches immutable data (a committed transaction never changes) over a JSON-RPC endpoint and renders a bounded DOM. That makes the budgets aggressive but achievable.

| Budget | Target | Notes |
| --- | --- | --- |
| Initial JS payload | ≤ 250 KB gzip for the app shell | `@ckb-ccc/core` is the only heavy dependency; avoid `@ckb-ccc/connector-react` (wallet UI). Confirm with a bundle analyzer before committing to the number. |
| First contentful paint | < 1.5 s on a warm cable connection | Ship the input bar and an empty flow skeleton before any RPC call resolves. |
| Time-to-first-flow | < 1.5 s from submit to a rendered flow for a typical transaction (≤ 20 inputs) against the public endpoint | One `get_transaction`, then input resolution fanned out in parallel (see §6). Render the spine and output cells immediately from the transaction body; stream input cell detail in as each `previous_output` resolves rather than blocking the whole flow on the slowest input. |
| Frame budget (connector draw-in and hover) | 16.6 ms/frame (60 fps) | Animate only compositor-friendly properties. Draw-in is `stroke-dashoffset` on SVG `<path>`; hover highlight is a class toggle changing stroke width/opacity, never a React re-render of the graph. No layout thrash on hover. |
| Interaction latency (hover highlight, open detail) | < 100 ms | Highlight by toggling a class on the SVG group, not by recomputing paths. |
| Max transaction rendered in full before virtualization | 50 cells per side (100 total) | Above that, group and collapse; see §15.4 for the resolved threshold and the grouped view. |

Caching is trivially correct here because confirmed transactions and their source cells are immutable. Wrap every read in TanStack Query keyed by `['tx', hash]` and `['cell', txHash, index]` with `staleTime: Infinity`; a re-visit or a lineage step back is served from memory with zero network.

### 13.2 Accessibility

The flow is a graph, but it must be operable and understandable without a mouse or a screen.

**Keyboard model for the flow.** The flow is a two-column composite widget with a single tab stop; once focused, it is a roving-tabindex grid. `Tab` enters the input column at the first cell. `ArrowUp`/`ArrowDown` move within a column, `ArrowLeft`/`ArrowRight` cross between the input column, the spine, and the output column. `Enter` or `Space` on a focused cell opens the detail panel; `Escape` closes it and returns focus to the cell that opened it. Cell-dep and witness lanes are reachable the same way when expanded. Lineage steps (trace backward/forward) are activated from the focused cell via a documented key or an in-cell button that is itself tabbable, and the breadcrumb is a normal focusable control row.

**Visible focus.** Every focusable element carries a visible focus ring that meets the design's hairline-border language (a 2 px ember outline, not a browser default glow). Focus is never removed with `outline: none` unless an equally visible replacement is drawn.

**Copyable everything.** Hashes, OutPoints, addresses, code hashes, and args each expose a copy affordance that is a real `<button>` with an accessible label (`Copy transaction hash`), reachable by keyboard, with a short live-region confirmation on copy.

**Contrast.** All text meets WCAG 2.1 AA: 4.5:1 for body and label text, 3:1 for large capacity numerals and for the hairline borders and connector strokes that carry meaning. The warm-dark palette is chosen and checked against these ratios, not eyeballed — the ember accent on the near-black base and the input/output tints are all verified.

**Reduced motion.** Under `prefers-reduced-motion: reduce`, connectors appear drawn rather than animating in, the lineage crossfade becomes an instant swap, and hover brightening remains (it is a state change, not decoration). No parallax, no autoplay.

**Screen-reader summary of the decode.** The plain-language decode is the primary content and is exposed as such: the summary banner is an `<h1>`/`<h2>` region read first, with the key readings (fee, size, input/output counts, block, timestamp, status) as an adjacent description list. The flow itself is given an accessible structure — an ordered list of inputs and outputs, each item announcing capacity, decoded lock and type names, and whether it carries data — so a screen-reader user hears "Input 1 of 3: 100 CKB, default lock, no type script" rather than an opaque canvas. Decoded meaning is always announced as inferred where it is inferred (see §8). When a script is unrecognized, the reader hears "unrecognized script" and the truncated code hash, never a guess.

### 13.3 Security

ckb-viz reads untrusted data from a chain and renders it. It signs nothing and holds no secrets, which removes whole classes of risk, but the data it renders is adversarial by default.

**RPC endpoint validation.** The node URL is user-configurable (§6). Validate it before use: require a well-formed absolute `http(s)`/`ws(s)` URL, reject anything else, and use it only as a JSON-RPC POST target — never interpolate it into markup or `eval` a response. A pasted endpoint is a request forgery vector for whatever network the browser sits on, so surface the configured endpoint plainly in the UI and treat switching it as an explicit user action.

**CORS and proxy.** The public node endpoints (`https://mainnet.ckb.dev/`, `https://testnet.ckb.dev/`) return `access-control-allow-origin: *`, so node reads work directly from the browser with no proxy. The Nervos Explorer REST API uses a CORS allowlist and returns no ACAO header for arbitrary origins, so any explorer-backed call (used only for forward lineage, §6) must go through a first-party proxy. That proxy is the only server-side component and it exists solely to add the required `Accept`/`Content-Type: application/vnd.api+json` headers and satisfy CORS.

**Treat cell data as untrusted — no injection when rendering decoded data.** Cell `data`, script `args`, `content_type`, and any decoded string (a token symbol from a Unique cell, a Spore or Cluster name/description, DOB traits) are attacker-controlled bytes. Render them only as text nodes; never `dangerouslySetInnerHTML`, never build DOM from a decoded string. Two specific traps: (1) Spore/DOB content can be an SVG or an HTML-ish `content_type` — SVG can carry script, so never inline SVG markup from cell content into the DOM; render image content only via an `<img>` fed a validated `data:` URI (an `<img>` cannot execute script) or inside a sandboxed iframe, and refuse to render content types you do not recognize. (2) A malicious token "symbol" or Spore "name" is just a string — display it truncated and escaped, and prefer a bundled/verified token list over trusting on-chain self-reported names for anything that looks like a label.

**No secrets in the client.** The app embeds no API keys. If a deployment fronts a private node or a paid provider that needs a key, the key lives in the proxy, never in shipped JS.

**SSRF on the proxy.** Any proxy the deployment runs must be a fixed-destination forwarder, not an open relay: allowlist the exact upstream hosts (the configured node and the explorer API), reject requests that try to specify an arbitrary target, and block resolution to internal/link-local IP ranges. A naive `?url=` passthrough proxy would let the internet reach the deployer's internal network through the browser app.

### 13.4 Number and hash formatting

Consistency here is most of the perceived quality, so the rules are fixed.

**Capacity.** All amounts are held internally as `BigInt` shannons parsed from the `0x`-hex RPC quantities; 1 CKB = 10^8 shannons. Format at the edge only: divide by 10^8, render the integer part with thousands separators and tabular-lining figures, and up to 8 fractional digits with trailing zeros trimmed (so `6,100,000,000` shannons shows as `61 CKB`, and a fee of `0x16923f7dcf` shows to its meaningful precision, not `61.00000000`). Always label the unit (`CKB`, `shannons`, `bytes`, `cycles`). Never do capacity math in floating point.

**Hashes and OutPoints.** Truncate long hex for display as `0x1234…cdef` (leading `0x` + first 4–6 hex + ellipsis + last 4), monospace, with a copy button that copies the full value; the untruncated value appears in the detail panel and on hover title. An OutPoint reads as `0x1234…cdef : 0` (truncated tx hash, colon, decimal index). Addresses are shown truncated the same way with copy of the full bech32m string.

**Since, epochs, block heights.** Decode `since` per §8/RFC0017 into a labeled human string ("relative epoch 0.5", "absolute block 4,191", "no lock" for 0); render block heights and indices as decimal with separators, timestamps as absolute UTC plus a relative age.

### 13.5 Internationalization posture

v1 ships English-only, but strings are not hardcoded inline into components — the plain-language decode phrases, labels, and error/empty-state copy live in one message table so a later locale pass is a translation, not a refactor. Numbers and dates go through `Intl` (`Intl.NumberFormat` for grouping, `Intl.DateTimeFormat` for timestamps) so locale-correct grouping and time formatting come for free when a locale is added. No layout assumption bakes in English text width; the design's monospace meta labels are content-agnostic.

### 13.6 Testing strategy

The decode logic is pure functions over bytes, which makes it cheap and mandatory to test.

- **Unit tests, on bundled fixtures.** The normalizer (raw source shape → §5 model), the registry lookup (code hash + hash type + optional args matcher → known script), the transaction decoder (cells/scripts → summary and per-cell meaning), the `since` decoder (all metric/relative combinations from RFC0017), the address encoder/decoder (RFC0021 full bech32m, plus parsing legacy short/deprecated addresses), the UDT amount decoder (`data[0..16]` LE u128), the DAO classifier (8-byte data zero vs deposit-block-height), and the Spore/Cluster molecule unwrap each get direct unit tests against fixtures bundled with the app.
- **Golden decode snapshots.** Each bundled example transaction (§16.3) has a checked-in golden snapshot of its full decode — summary sentence, per-cell meaning, resolved script names — so any regression in decoding is caught as a snapshot diff. These double as the fixtures the demo loads with no endpoint.
- **Component tests.** The cell card (capacity, script tags, data indicator, states), the flow layout and connector anchoring, and the detail panel are tested for correct rendering and for the keyboard model of §13.2 (roving focus, Enter/Escape, copy buttons).
- **Visual checks.** The signature flow and the theme (light/dark, reduced motion) get visual-regression coverage on a couple of representative transactions so the design floor does not silently erode.

## 14. Delivery phases and acceptance criteria

Five phases, each shippable and each producing a concrete demo. A phase is done when every box in its acceptance checklist is true, not when the code merely runs.

### 14.1 Phase 1 — Load and render the flow

**Scope.** Fetch a transaction by hash from a CKB node via `get_transaction` (verbosity 2), resolve each input's `previous_output` to a full cell (try `get_live_cell`; on non-live, fall back to `get_transaction(previous_output.tx_hash)` and index into `outputs`/`outputs_data`), normalize to the §5 model, and render the flow: input column, spine, output column, connectors, capacity totals per side, and the fee as the difference. Cells show raw scripts by shortened code hash — no decoding yet. Network selector for mainnet/testnet. Example transactions bundled so the tool works with no endpoint configured.

**Acceptance criteria.**
- [ ] Pasting a valid mainnet or testnet tx hash renders the flow within the §13.1 time-to-first-flow budget.
- [ ] Every input shows resolved capacity, lock, type, and a data indicator — not just an OutPoint — including inputs whose source cell is already spent.
- [ ] Capacity totals anchor each side and the displayed fee equals `sum(inputs.capacity) − sum(outputs.capacity)` in shannons, formatted per §13.4.
- [ ] `outputs` and `outputs_data` are rendered as index-aligned pairs; witnesses render as an independent list.
- [ ] Network switch reloads against that network's endpoint; status, block number, and timestamp come from `tx_status` + `get_header(block_hash)`.
- [ ] Bundled examples load and render fully with no endpoint configured.
- [ ] Error and empty states (bad hash, unknown tx, unreachable endpoint) say what happened and what to do, in plain language.

**Demo.** Paste a real mainnet transfer hash and watch the flow draw with correct capacities and fee; then load it again offline from the bundled example.

### 14.2 Phase 2 — Registry and decoder

**Scope.** The per-network script registry seeded with the §16.2 known scripts, and the transaction decoder: known locks and types shown by name and category, the one-sentence plain-language summary in the banner, and per-cell decoded meaning. UDT amounts decoded from cell data; DAO deposit vs withdrawal classified; Spore/Cluster mint/transfer/melt inferred from where the cell appears. Everything inferred is labeled inferred; unknown scripts are shown truncated and marked unrecognized, never guessed.

**Acceptance criteria.**
- [ ] A default-lock, no-type transaction summarizes as a CKB transfer with amount moved and change returned.
- [ ] An sUDT/xUDT output decodes its amount from `data[0..16]` LE u128 and names the token by type where resolvable (§15.2), or shows "unknown token" with the truncated type hash otherwise.
- [ ] A Nervos DAO cell is classified deposit vs withdrawal from its 8-byte data and confirmed against the DAO code hash before interpretation.
- [ ] Spore/Cluster cells decode name/content-type from molecule and are summarized as mint/transfer/melt by input/output presence.
- [ ] Registry is keyed per network; the same code hash on mainnet vs testnet resolves correctly (verify the xUDT `data1`-vs-`type` asymmetry explicitly).
- [ ] Unrecognized scripts render neutral and clearly unrecognized; nothing is labeled with a name it did not match.
- [ ] Golden decode snapshots exist and pass for every bundled example.

**Demo.** Load one example per category and read each summary sentence aloud — a token transfer, a DAO deposit, a Spore mint — each correct and each marked inferred where inferred.

### 14.3 Phase 3 — Detail panel

**Scope.** Selecting a cell opens the detail panel: exact capacity and occupied capacity, lock and type scripts with full code hash, hash type, and args, raw data plus a decoded view where the script is known, the decoded meaning in words, and copy actions on every hash. Registry scripts link to a short explanation of what they do.

**Acceptance criteria.**
- [ ] Opening and closing the panel follows the keyboard model of §13.2 (Enter opens, Escape closes and restores focus).
- [ ] Occupied capacity is computed from raw field lengths (`8 + 32 + 1 + len(args)` per script, `+ len(data)`, type contributes 0 when absent) and shown against capacity.
- [ ] Full code hash, hash type, and args are shown and each is copyable; decoded data (UDT amount, DAO state, Spore fields, `since`) shown where the script is known.
- [ ] Decoded data is rendered as text only, with no HTML/SVG injection path from cell content (§13.3); unrecognized `content_type` is not rendered as active content.
- [ ] Known scripts show a one-paragraph explanation of their behavior.

**Demo.** Click a token cell and a DAO cell; show the full script detail, the decoded amount/state, and copy the full type-script hash to the clipboard.

### 14.4 Phase 4 — Lineage

**Scope.** Backward lineage first, from node data alone: from any input, follow its OutPoint to the creating transaction and render it in the same flow. Then forward lineage via an optional indexer or explorer source: from any output, follow it to the consuming transaction if one exists. A breadcrumb records the path and lets the user step back. Degrade gracefully to backward-only when only a node is available.

**Acceptance criteria.**
- [ ] From any input, tracing backward loads and renders the creating transaction; the breadcrumb records the step and supports stepping back.
- [ ] Backward lineage works against a node alone, with no indexer or proxy.
- [ ] Forward lineage, when an indexer/explorer source is configured, resolves an output's consuming transaction (indexer `get_transactions` by the cell's script filtered to `io_type == "input"`, then match `previous_output`; or explorer `display_outputs[i].consumed_tx_hash`).
- [ ] With no forward source configured, forward tracing is shown as unavailable — never fabricated — and backward tracing still works.
- [ ] Lineage transitions honor reduced motion (instant swap under `prefers-reduced-motion`).

**Demo.** Start on a token transfer, step backward to the transaction that funded an input, then forward from an output to where it was spent, walking the breadcrumb both directions.

### 14.5 Phase 5 — Full design pass

**Scope.** The signature treatment and the quality floor from §10 and §13: connector flow with draw-in and hover brightening, minimal meaningful motion, responsive down to a narrow viewport, complete empty/error/loading states, and the grouped/virtualized view for large transactions (§15.4). This is where the tool earns being remembered by its connector flow.

**Acceptance criteria.**
- [ ] Connectors draw in on load and brighten instantly on hover, within the frame budget of §13.1, with no per-frame React re-render of the graph.
- [ ] The layout is responsive to a narrow viewport with no horizontal page scroll; wide content scrolls within its own container.
- [ ] Keyboard focus is visible everywhere and the full flow is operable by keyboard (§13.2).
- [ ] Contrast and reduced-motion requirements pass an audit.
- [ ] Transactions above the §15.4 threshold render grouped with expanders (and virtualized where a group is very large), with off-screen connectors stubbed at the column edge rather than drawn to nowhere.
- [ ] Empty, loading, and error states are present and legible for every surface.

**Demo.** Load a large, script-dense transaction and a plain transfer side by side; show the grouped view expanding, the connector flow on hover, and the whole thing operated from the keyboard with reduced motion on and off.

## 15. Open questions resolved

The draft's four open questions, decided.

### 15.1 Registry keying and args matching

**Decision.** Key the registry primarily on `(network, code_hash, hash_type)`, and layer an **optional `argsMatcher`** on entries that need to refine identity or behavior from args. Resolution is two-stage: match the `(code_hash, hash_type)` pair for the active network to get the script's name and category, then, if the entry carries an `argsMatcher`, run it over the args to derive a sub-label or extracted fields.

**Rationale.** The `(code_hash, hash_type)` pair is the correct primary key: hash type is load-bearing, not cosmetic — xUDT is `data1` on mainnet but `type` on testnet, multisig v1 and v2 differ by hash type, so keying on code hash alone would mislabel. But several scripts encode identity in args that a name alone cannot express: an sUDT/xUDT's owner-lock hash lives in the first 32 args bytes, Omnilock's auth mode is a flag byte in args, a TYPE_ID or Unique cell's args is a derived 32-/20-byte id. The `argsMatcher` is where that refinement happens (extract the owner-lock hash to key token identity, read the Omnilock auth flag to say "Omnilock (secp256k1)" vs "Omnilock (multisig)") without polluting the primary key or forcing every script to define one. Most entries need no matcher; the ones that do get exactly the hook they need.

### 15.2 Token identity resolution

**Decision.** A UDT's identity is its **type-script hash** (blake2b of `code_hash + hash_type + args`), never a name parsed from args. Always decode and show the raw amount (`data[0..16]` LE u128). Resolve a human symbol/decimals in this order: (1) the token's linked **Unique cell** (token-info) when present, decoded as `decimals(1) | name_len(1) | name | symbol_len(1) | symbol`; (2) a **bundled off-chain token list** keyed by type-script hash for the well-known tokens, optionally augmented by the CKB Explorer UDT registry through the proxy; (3) fall back to "unknown token" with the truncated type hash and the raw amount. When decimals are unknown, show the raw integer amount and say the decimals are unknown rather than assuming a scale.

**Rationale.** RFC0025/0052 put no human name in the UDT cell or its type args — the first 32 args bytes are the owner-lock hash, not a symbol — so any name must come from a separate source, and on-chain self-reported names (Unique cell, Spore) are attacker-controlled strings to be treated per §13.3. A bundled list keyed by type-script hash gives correct, verifiable symbols for the tokens that matter without a hard dependency on any external service, and the Unique-cell path handles tokens not on the list. This keeps v1 dependency-light while never showing a wrong or unescaped symbol.

### 15.3 Forward lineage in v1

**Decision.** Ship **backward lineage in v1** (node-only, O(1) via `get_transaction`/`get_live_cell`). Implement **forward lineage in Phase 4 as an optional capability** gated on a configured indexer or explorer source, degrading gracefully to backward-only. It is not deferred out of v1, but it is never a hard requirement for the app to function.

**Rationale.** A CKB node exposes no reverse index from an OutPoint to its consumer; forward tracing requires either the built-in indexer's `get_transactions` (script-keyed, multi-call, but CORS-`*` and proxy-free) or the Explorer API's `consumed_tx_hash` (one call, but CORS-allowlisted and therefore needs a proxy). Both are real dependencies with real failure modes, while backward lineage is free and reliable. Making forward lineage optional lets the core tool ship on a bare node and still deliver the "where did this come from, where did it go" story in the backward direction, then light up forward tracing wherever a richer source is available — exactly the graceful-degradation posture §6 already commits to.

### 15.4 Large-transaction grouping and virtualization

**Decision.** Render **in full up to 50 cells per side (100 total)**. Above that, **group and collapse** each over-long column into summarized rows (grouped by decoded script/category, e.g. "42 sUDT outputs · 12,300 CKB") with an expander per group. When a single expanded group exceeds **~200 rows**, **virtualize** it with `@tanstack/react-virtual`, and stub connectors for off-screen rows at the column edge rather than drawing them to nowhere. Grouping is the first line of defense because virtualization fights the connector-to-off-screen-row problem; virtualization is the fallback only inside a large expanded group.

**Rationale.** The connector flow is the signature, and it only reads when endpoints are on-screen — so the design must reduce the row count (grouping) before it resorts to hiding rows (virtualization). Fifty per side is comfortably above ordinary transactions while staying well within a smooth DOM and the frame budget of §13.1; grouping by decoded category is meaningful (it tells the reader "this is a batch of token outputs") rather than an arbitrary page break; and reserving virtualization for very large expanded groups keeps the common case pure DOM with real connectors. The grouped view is itself a decode: it says what the bulk of the transaction is doing without forcing the reader to scroll a hundred near-identical cells.

## 16. Appendices

### 16.1 References

Primary CKB sources. Code hashes and cell-dep out-points below and in §16.2 are **reference data to verify against the live deployment** before relying on them (§7); the RFC structural and decode-format claims are confirmed against the sources cited here.

- RFC0017 — Transaction valid since: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md
- RFC0019 — Data structures (cell, script, transaction, capacity): https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0019-data-structures/0019-data-structures.md
- RFC0021 — CKB address format (bech32m full payload): https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0021-ckb-address-format/0021-ckb-address-format.md
- RFC0022 — Transaction structure (tx/script hash, TYPE_ID): https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md
- RFC0023 — Nervos DAO deposit/withdraw: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md
- RFC0024 — CKB system script list: https://nervosnetwork.github.io/rfcs/rfcs/0024-ckb-system-script-list/0024-ckb-system-script-list.html
- RFC0025 — Simple UDT (sUDT): https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md
- RFC0042 — Omnilock: https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md
- RFC0052 — Extensible UDT (xUDT): https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0052-extensible-udt/0052-extensible-udt.md
- CKB molecule schema (`blockchain.mol`): https://github.com/nervosnetwork/ckb/blob/develop/util/gen-types/schemas/blockchain.mol
- CKB JSON-RPC reference (`rpc/README.md`) and Rust types (`util/jsonrpc-types`): https://github.com/nervosnetwork/ckb/blob/develop/rpc/README.md
- CCC SDK (recommended JS/TS library; `@ckb-ccc/core`, known-script config): https://github.com/ckb-devrel/ccc
- Spore contract molecule schemas (`spore_v1.mol`, `spore_v2.mol`): https://github.com/sporeprotocol/spore-contract/tree/master/lib/types/schemas
- DOB/0 protocol: https://docs.spore.pro/dob/dob0-protocol
- Unique cell / token-info layout: https://github.com/utxostack/unique-cell
- RGB++ / BTC-time-lock constants: https://github.com/utxostack/rgbpp-sdk/blob/develop/packages/ckb/src/constants/index.ts
- Nervos public RPC endpoints and glossary: https://docs.nervos.org/docs/getting-started/rpcs , https://docs.nervos.org/docs/tech-explanation/glossary
- Nervos Explorer REST API (forward lineage via `display_outputs`): https://ckb-explorer.readme.io/reference/transaction

### 16.2 Well-known script reference

Seed data for the registry (§7). Every value is **reference — verify against the current deployment**; cell-dep out-points in particular can change on redeployment even when the code hash is stable, so resolve type-id-backed deps live. Note the network asymmetries: xUDT is `data1` on mainnet but `type` on testnet, and Unique is `data1` on mainnet but `type` on testnet.

| Name | Category | Network | code_hash | hash_type |
| --- | --- | --- | --- | --- |
| secp256k1_blake160 sighash (default lock) | lock | both | `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8` | type |
| secp256k1 multisig (v1) | lock | both | `0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8` | type |
| anyone-can-pay (ACP) | lock | mainnet | `0xd369597ff47f29fbc0d47d2e3775370d1250b85140c670e4718af712983a2354` | type |
| anyone-can-pay (ACP) | lock | testnet | `0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356` | type |
| Omnilock | lock | mainnet | `0x9b819793a64463aed77c615d6cb226eea5487ccfc0783043a587254cda2b6f26` | type |
| Omnilock | lock | testnet | `0xf329effd1c475a2978453c8600e1eaf0bc2087ee093c3ee64cc96ec6847752cb` | type |
| JoyID | lock | mainnet | `0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323` | type |
| JoyID | lock | testnet | `0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac` | type |
| RGB++ lock | lock | mainnet | `0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936` | type |
| RGB++ lock | lock | testnet (BTC testnet3) | `0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248` | type |
| sUDT | type | mainnet | `0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5` | type |
| sUDT | type | testnet | `0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4` | type |
| xUDT | type | mainnet | `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95` | data1 |
| xUDT | type | testnet | `0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb` | type |
| Nervos DAO | type | both | `0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e` | type |
| TYPE_ID (built-in, no cell dep) | type | both | `0x00000000000000000000000000000000000000000000000000545950455f4944` | type |
| Spore (V2/latest) | type | mainnet | `0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5` | data1 |
| Spore (V2/latest) | type | testnet | `0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d` | data1 |
| Cluster (V2/latest) | type | mainnet | `0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075` | data1 |
| Cluster (V2/latest) | type | testnet | `0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058` | data1 |
| Unique (token-info) | type | mainnet | `0x2c8c11c985da60b0a330c61a85507416d6382c130ba67f0c47ab071e00aec628` | data1 |
| Unique (token-info) | type | testnet | `0x8e341bcfec6393dcd41e635733ff2dca00a6af546949f70c57a706c0f344df8b` | type |

### 16.3 Bundled example transactions

One per decode category, so every feature is reachable offline with no endpoint configured (§9.1) and each doubles as a golden-snapshot fixture (§13.6). Real hashes must be filled from live mainnet/testnet transactions before shipping; the placeholders name what each example must exercise.

| Category | Network | Tx hash | Must exercise |
| --- | --- | --- | --- |
| Plain CKB transfer | mainnet | `0x…` (fill) | default lock only, no type scripts; amount moved + change; fee as balance difference |
| sUDT token transfer | mainnet | `0x…` (fill) | sUDT type on outputs; amount from `data[0..16]`; token identity via type hash |
| xUDT token transfer | mainnet | `0x…` (fill) | xUDT `data1` on mainnet; amount decode; owner-lock hash in args |
| Nervos DAO deposit | mainnet | `0x…` (fill) | DAO type on output; 8-byte all-zero data ⇒ deposit |
| Nervos DAO withdrawal | mainnet | `0x…` (fill) | DAO cell in input; non-zero data ⇒ deposit block height |
| Spore mint | testnet | `0x…` (fill) | Spore type in outputs; `SporeData` molecule; content-type/name decode |
| Spore/Cluster transfer or melt | testnet | `0x…` (fill) | cell in inputs and/or outputs ⇒ transfer vs melt |
| Multisig / ACP / Omnilock lock | mainnet | `0x…` (fill) | non-default lock named by registry; args-matcher sub-label |
| `since`-locked input | mainnet | `0x…` (fill) | non-zero `since`; relative/absolute + block/epoch/timestamp decode |
| Unrecognized script | either | `0x…` (fill) | a script not in the registry shown truncated and marked unrecognized |
| Large / grouped transaction | mainnet | `0x…` (fill) | > 50 cells per side ⇒ grouped view and (if a group is huge) virtualization |

### 16.4 Glossary

Terms used throughout — Cell, Capacity, OutPoint, Input, Output, Lock script, Type script, Cell dep, Known script, Lineage — are defined once in **§4. Terminology**. This appendix intentionally does not restate them; §4 is the single source.
