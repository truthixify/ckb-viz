# ckb-viz

A read-only visualizer for [Nervos CKB](https://www.nervos.org/) transactions. Paste a
transaction hash and see it as a clear flow of cells: inputs on the left, outputs on the
right, with capacity, the fee, decoded scripts, and cell lineage.

Live at **[ckb-viz.truthixify.dev](https://ckb-viz.truthixify.dev/)**.

CKB's cell model is hard to read in the raw. A transaction straight from a node is a wall
of hex: capacities in shannons, 32-byte code hashes, packed `since` values, serialized
witnesses. None of it tells you that Alice sent some CKB and a few tokens to Bob and got
change back. ckb-viz fetches the transaction and every cell it touches, decodes each one,
names what it can, and lays it out so you can see what happened.

It only reads. No wallet, no signing, no writes.

## Features

- **The flow.** Inputs, the transaction in the middle, and outputs across three columns,
  joined by curved connectors. Hover or focus a cell to highlight its connections.
  Capacity totals sit on each side, so the fee is the difference between them.
- **Opens on the latest transaction** for the selected network, so there is always
  something to look at.
- **Script decoding.** Locks and types are matched against a per-network registry
  (Secp256k1, Multisig, ACP, Omnilock, JoyID, RGB++, sUDT, xUDT, Nervos DAO, Spore,
  Cluster). Unknown scripts show a shortened code hash and are marked unrecognized rather
  than guessed.
- **Plain-language summary.** A one-line description of the transaction (a CKB transfer, a
  token transfer, a Nervos DAO deposit, a Spore mint), always labeled as inferred.
- **Cell detail.** Exact and occupied capacity, the full lock and type scripts, the raw
  data with a decoded view, and a copy button on everything.
- **Lineage.** Follow an input back to the transaction that created it, or an output
  forward to the one that spent it, with a breadcrumb of the path you took.
- **Field decoders** for UDT amounts, Nervos DAO deposit versus withdrawal, the `since`
  timelock, `WitnessArgs`, and ckb2021 addresses. Best-effort and labeled.
- **A learn primer** at `/learn`: an interactive walk through the cell model for people
  new to CKB.
- **Mainnet and testnet**, each with its own registry and endpoint.
- Keyboard operable, visible focus, copyable values, plain empty, loading and error
  states, and `prefers-reduced-motion` respected.

## How it works

The only backend is a CKB JSON-RPC node. The default public endpoints (`mainnet.ckb.dev`
and `testnet.ckb.dev`) bundle the indexer and allow browser requests, so ckb-viz calls
them directly, with no server of its own.

Each transaction runs through a small pipeline: fetch it and resolve every input's
previous output, normalize the node's hex shapes into one model with amounts as `bigint`
counts of shannons, match the scripts against the registry, decode each cell, and render
the flow. Capacity math stays in integer shannons and is only formatted to CKB at the
render edge.

## Design

Dark and near-black, with depth coming from lightness and hairline borders rather than
shadows. Squared corners throughout, with circles reserved for status dots. Monospace
carries the hashes, capacities, and labels, and capacity is the largest type on each cell.
One warm accent, ember, marks the transaction spine, the connectors, and the focused
element. Everything else stays quiet.

## Tech

- React 18, Vite, TypeScript (strict)
- Tailwind CSS v4, with the design tokens as theme variables
- TanStack Query for RPC caching, since a committed transaction never changes
- [CCC](https://github.com/ckb-devrel/ccc) for the JSON-RPC client, the molecule codec,
  and script and address handling
- Self-hosted Geist and Geist Mono

## Getting started

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build      # typecheck and production build
npm run preview    # preview the production build
npm run test       # unit tests (Vitest)
npm run lint       # lint
```

The default endpoints live in `src/app/config.ts` if you want to point at your own node.

## Project structure

```
src/
  app/          shell, source factory, query hooks, config
  domain/       the model, units (shannon and CKB), hex, errors
  source/       the transaction source and the live node adapter
  registry/     per-network script registry and code hashes
  decode/       the decoder, field decoders, and enrichment
  components/   flow, shell, detail panel, states, the learn primer
  styles/       design tokens
```

## Not in scope

Not a block explorer, not a wallet, not an indexer of its own. One transaction at a time.
