# CLAUDE.md — working guide for ckb-viz

This file governs how work is done in this repository. It is guidance for any
agent or contributor. It deliberately does **not** duplicate product or technical
detail — that lives in one place.

## Source of truth

**[`SPEC.md`](./SPEC.md) is the single source of truth** for what ckb-viz is,
what it does, its data model, the script registry, the decoder, the surfaces,
the design system, the architecture, and the delivery phases. Before writing
code, read the relevant section of `SPEC.md`. When code and `SPEC.md` disagree,
`SPEC.md` wins — either fix the code or, if the spec is wrong, update `SPEC.md`
in the same change and say so in the commit.

ckb-viz is a **read-only CKB (Nervos) transaction visualizer**: paste a
transaction hash, see the input→output cell flow with capacity and fee, decoded
scripts, a plain-language summary, a cell detail panel, and cell lineage. It is
not a wallet, not a signer, not an indexer, and not a block explorer. See
`SPEC.md` §3 (Non-goals) before adding anything that stretches that boundary.

## Git and commits

- **Commit regularly.** Prefer small, self-contained commits over large ones.
  Each commit should build and leave the tree in a working state.
- **Push once a batch is done.** When a coherent batch of related work is
  complete (a component, a module, a phase slice), push it. Do not sit on many
  local commits; do not push half-finished, non-building work either.
- **No co-author / trailer.** Do **not** add `Co-Authored-By` trailers or any
  "generated with" attribution to commit messages.
- **Commit messages:** imperative mood, concise subject (~72 chars), a body only
  when the change needs a why. Describe intent, not a file list.
- Branch off the default branch for non-trivial work; keep the default branch
  green. Never commit secrets, RPC keys, or `.env` files — see `.gitignore`.

## Comments and code hygiene

- **No numbered comments.** Do not write step-numbered comments (`// 1. …`,
  `// 2. …`, `// Step 3`). If a sequence needs explaining, name the steps in
  code (well-named functions/variables) or write a short prose comment.
- **No `TODO` / `FIXME` / `XXX` comments.** Do not leave TODOs in the codebase.
  If something is genuinely deferred, track it in `SPEC.md` (e.g. the delivery
  phases or open questions) or an issue — not as a comment rotting in the source.
- Comment **why**, not **what**. The code says what; a comment earns its place
  only by explaining intent, a non-obvious constraint, or a CKB-specific gotcha.
- Match the surrounding code's naming, structure, and idiom. Consistency beats
  personal preference.
- No dead code, no commented-out blocks, no leftover debug logging.

## Code conventions

- **TypeScript, strict.** No `any` in committed code (use `unknown` + narrowing).
  Model the domain with the types from `SPEC.md` §5; keep them the shared contract.
- **Amounts are `bigint` shannons internally**, formatted to CKB only at the
  render edge (1 CKB = 1e8 shannon). Never do capacity math in floating point.
- **Never guess an unknown script.** Unrecognized scripts are shown as a
  shortened code hash, clearly marked unrecognized (`SPEC.md` §7). Decoding is
  best-effort and always labeled inferred (`SPEC.md` §8).
- **Registry code hashes are reference data**, verified against the live
  deployment — do not treat them as immutable truths hardcoded forever.
- **Treat all on-chain data as untrusted.** Cell data, args, and witnesses are
  attacker-controlled. Never inject decoded data into the DOM as HTML; render as
  text. Validate any user-supplied RPC endpoint (`SPEC.md` §13).
- Respect the module boundaries in `SPEC.md` §11: source adapter → normalizer →
  registry → decoder → view. Keep the data source behind its interface so a node,
  indexer, or explorer API can back it without touching the rest of the app.
- Prefer pure, testable functions for the normalizer, registry lookup, and
  decoder. Side effects (RPC, DOM) live at the edges.

## Testing and verification

- Unit-test the pure logic: normalizer, registry lookup, decoder, `since` and
  address decoding — using the bundled example transactions as fixtures
  (`SPEC.md` §13). Add a golden/snapshot decode per example category.
- Before pushing a batch, run the project's typecheck, lint, and tests. If a
  check fails, fix it or say so plainly — do not push red.
- When changing rendering or decode behavior, verify against a real example
  transaction, not just types.

## Quality floor

Honor the `SPEC.md` §13 quality floor on everything shipped: keyboard focus is
visible, everything hash-like is copyable, empty/loading/error states say what
happened in plain language, the layout survives a narrow viewport, and
`prefers-reduced-motion` is respected. Accessibility and error states are part
of "done," not a later pass.

## When in doubt

Re-read the relevant `SPEC.md` section. If the spec is silent or ambiguous,
make the smallest reasonable decision consistent with its intent, implement it,
and note the decision in `SPEC.md` (§15 Open questions) so the spec stays the
source of truth.
