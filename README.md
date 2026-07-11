# ckb-viz

**A read-only visualizer for [Nervos CKB](https://www.nervos.org/) transactions.**
Paste a transaction hash — or just open it — and see the transaction as a legible
flow of cells: inputs on the left, outputs on the right, the transaction spine
between them, with capacity, the fee, decoded scripts, and cell lineage in view.

### → [ckb-viz.truthixify.dev](https://ckb-viz.truthixify.dev/)

The cell model is the single hardest thing about CKB to hold in your head. A raw
transaction from a node is a wall of `0x`-prefixed hex — capacities in shannons,
32-byte code hashes, packed `since` values, molecule-serialized witnesses.
Nothing about it announces *"Alice sent 100 CKB and 1,500 tokens to Bob and got
change back."* ckb-viz closes that gap: it fetches the transaction and every cell
it touches, decodes each one to script-level detail, names what is nameable, and
lays the whole thing out so the shape of the state transition reads at a glance.

It reads, and only reads — no wallet, no signing, no writes.

## Features

- **The flow.** Input cells, the transaction spine, and output cells laid across
  three columns, connected by curved connectors drawn from the live layout.
  Hovering (or keyboard-focusing) a cell brightens its connectors and dims the
  rest. Capacity totals anchor each side, so the fee reads as the difference.
- **Opens on the latest transaction.** No hunting for a hash — the tool boots on
  the network's most recent transaction and refetches when you switch network.
- **Script decoding.** Lock and type scripts are matched against a per-network
  registry (Secp256k1, Multisig, ACP, Omnilock, JoyID, RGB++, sUDT, xUDT, Nervos
  DAO, Spore, Cluster). Unknown scripts are shown by a shortened code hash and
  clearly marked unrecognized — never guessed.
- **Plain-language summary.** A one-sentence headline — a CKB transfer, a token
  transfer of a named amount, a Nervos DAO deposit, a Spore mint — always marked
  as inferred, never presented as ground truth the chain asserted.
- **Cell-level detail.** Exact and occupied capacity, the full lock and type
  scripts (code hash, hash type, args, meaning), the raw data with a decoded view,
  and copy-everything.
- **Lineage.** Trace an input back to the transaction that created it, and an
  output forward to the transaction that spent it (via the node's built-in
  indexer), with a breadcrumb of the path you walked.
- **Field decoders.** UDT amounts (leading 16-byte little-endian `u128`), Nervos
  DAO deposit vs. withdrawal, the `since` timelock (RFC0017), `WitnessArgs`, and
  ckb2021 addresses — grounded in the chain, best-effort, and labeled.
- **Both networks**, mainnet and testnet, each with its own registry and endpoint.
- **Quality floor.** Keyboard-operable, visible focus, everything copyable, plain
  empty / loading / error states, large transactions grouped rather than sprawled,
  and `prefers-reduced-motion` respected.

## How it works

A live CKB JSON-RPC node is the only backend. The default public endpoints
(`mainnet.ckb.dev` / `testnet.ckb.dev`) bundle the indexer and serve permissive
CORS, so the browser calls them directly — no proxy, no server of ckb-viz's own.

The data flows through a small, testable pipeline:

```
TransactionSource ──▶ normalize ──▶ ScriptRegistry ──▶ decoder ──▶ FlowCanvas
   (node RPC)         (raw → §5        (name known       (per-cell     (the flow,
                       model, bigint    scripts)          meaning +     detail panel,
                       shannons)                          headline)     lineage)
```

- **`TransactionSource`** is the seam every backend hides behind. It fetches a
  transaction, resolves each input's previous output (`get_live_cell`, falling
  back to `get_transaction` on a spent cell), reads the header for the timestamp,
  and finds an output's consuming transaction via the indexer.
- **Normalize** turns the node's snake-case, hex-quantity shapes into one
  camelCase model with every amount as a `bigint` count of shannons. Capacity math
  is exact integer arithmetic; CKB is formatted only at the render edge
  (`1 CKB = 10^8 shannons`).
- **Registry + decoder** are pure functions — easy to test, and the place all the
  CKB-specific knowledge lives.

The full technical specification is in **[SPEC.md](./SPEC.md)**.

## Design

ckb-viz reads like an instrument panel, not a web app: a dark, warm, near-black
base; elevation by lightness steps and hairline borders, never shadow or glow;
squared corners everywhere (the only circles are status dots); monospace
(Geist Mono) carrying the hashes, capacities, and labels, with capacity as the
largest type on each cell; and a single warm accent — ember — reserved for the
transaction spine, the connectors, and the focused element. The connector flow is
the thing the tool is remembered by, so it gets the care and everything else stays
quiet.

## Tech stack

- **[React](https://react.dev/) 18 + [Vite](https://vite.dev/) + TypeScript** (strict)
- **[Tailwind CSS](https://tailwindcss.com/) v4** with the design tokens as theme variables
- **[TanStack Query](https://tanstack.com/query)** for RPC caching (a committed tx is immutable)
- **[CCC (`@ckb-ccc/core`)](https://github.com/ckb-devrel/ccc)** for the JSON-RPC client, molecule codec, and script/address handling — code-split so the initial bundle stays light
- Self-hosted **Geist** / **Geist Mono**

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm run test       # run the unit tests (Vitest)
npm run typecheck  # typecheck only
npm run lint       # ESLint
```

The default endpoints are configured in [`src/app/config.ts`](./src/app/config.ts)
— point them at your own node if you prefer.

## Project structure

```
src/
  app/          app shell, source factory, query hooks, config
  domain/       the normalized model, units (shannon ⇄ CKB), hex, errors
  source/       TransactionSource + the live node adapter (CCC)
  registry/     per-network script registry, code hashes, dep out-points
  decode/       transaction decoder + field decoders + enrichment pipeline
  components/   flow (canvas, cell card, spine, connectors), shell, detail, states
  styles/       design tokens
```

## Non-goals

Not a block explorer (no address pages, rich-lists, or block browsing), not a
wallet, not an indexer of its own. One transaction at a time, done well. See
[SPEC.md §3](./SPEC.md).

## Notes

Well-known script code hashes are reference data, verified against the live
deployment — see [SPEC.md §7](./SPEC.md). Contribution conventions live in
[CLAUDE.md](./CLAUDE.md).
