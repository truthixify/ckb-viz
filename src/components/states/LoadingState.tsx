/** A calm skeleton while a transaction resolves (SPEC §9.7). */
export function LoadingState() {
  return (
    <div className="flex animate-pulse flex-col gap-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading transaction…</span>
      <div className="flex flex-col gap-6 border border-hairline bg-panel px-7 py-6">
        <div className="h-3 w-40 bg-raised" />
        <div className="h-8 w-96 max-w-full bg-raised" />
        <div className="flex flex-wrap gap-x-12 gap-y-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-2.5 w-12 bg-raised" />
              <div className="h-3.5 w-20 bg-raised" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8">
        <div className="flex flex-col items-start gap-5">
          <SkeletonCard />
        </div>
        <div className="h-40 w-[300px] max-w-[34vw] border border-hairline bg-panel" />
        <div className="flex flex-col items-end gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex w-[240px] max-w-full flex-col gap-3.5 border border-hairline bg-panel px-5 py-4">
      <div className="h-2.5 w-16 bg-raised" />
      <div className="h-7 w-28 bg-raised" />
      <div className="h-4 w-24 bg-raised" />
    </div>
  )
}
