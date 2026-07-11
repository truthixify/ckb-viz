/** A transient toast confirming a copy (SPEC §9.6 copy affordance). */
export function CopyToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 border border-border bg-panel-2 px-4 py-2"
    >
      <span className="mono text-[11px] uppercase tracking-[0.12em] text-bone-dim">{message}</span>
    </div>
  )
}
