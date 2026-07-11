import { describeError } from '@/domain/errors'

/**
 * An error state that says what happened and what to do in plain language
 * (SPEC §9.7) — bad hash, tx not found, endpoint/CORS failure.
 */
export function ErrorState({ error }: { error: unknown }) {
  const { title, body } = describeError(error)
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: 'var(--color-alarm)' }}
      />
      <div className="flex flex-col gap-2">
        <h2 className="text-[18px] font-medium tracking-tight text-bone">{title}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-bone-dim">{body}</p>
      </div>
    </div>
  )
}
