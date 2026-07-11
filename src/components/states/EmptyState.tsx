import { Glyph } from '../brand/Glyph'

/** The landing state: paste a hash or pick an example (SPEC §9.7). */
export function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <Glyph size={56} className="opacity-80" />
      <div className="flex flex-col gap-3">
        <h2 className="text-[22px] font-medium tracking-tight text-bone">
          Read a CKB transaction
        </h2>
        <p className="max-w-md text-[13px] leading-relaxed text-bone-dim">
          Paste a transaction hash above, or pick an example, to see its cells flow from
          inputs to outputs — scripts decoded, capacity and fee in view.
        </p>
      </div>
    </div>
  )
}
