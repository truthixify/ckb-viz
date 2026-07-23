import { useCallback, useEffect, useState } from 'react'
import { clsx } from '@/app/clsx'
import '@/styles/learn.css'
import { CHAPTERS } from './scenes'

/**
 * The /learn primer: an animated, step-through explanation of UTXO, the CKB
 * cell model, the anatomy of a transaction, and its lifecycle. Each chapter is
 * a self-contained animated scene that replays on entry (keyed remount), with a
 * short narration beneath it. Ends by handing off to the real visualizer.
 */
export function LearnView({ onExplore }: { onExplore: () => void }) {
  const [i, setI] = useState(0)
  const chapter = CHAPTERS[i]!
  const last = CHAPTERS.length - 1

  const go = useCallback((next: number) => setI(Math.min(last, Math.max(0, next))), [last])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((c) => Math.min(last, c + 1))
      if (e.key === 'ArrowLeft') setI((c) => Math.max(0, c - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  const Scene = chapter.Scene

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col gap-6">
      {/* progress */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {CHAPTERS.map((c, k) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.title}
              onClick={() => go(k)}
              className={clsx(
                'h-1.5 transition-all',
                k === i ? 'w-6 bg-ember' : k < i ? 'w-1.5 bg-bone-dim' : 'w-1.5 bg-hairline',
              )}
            />
          ))}
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {String(i + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}
        </span>
      </div>

      {/* scene — keyed so animations replay on entry */}
      <div className="flex min-h-[340px] items-center justify-center overflow-hidden border border-hairline bg-panel px-4 py-8 min-[560px]:min-h-[380px] min-[560px]:px-8">
        <Scene key={chapter.id} />
      </div>

      {/* narration */}
      <div className="flex flex-col gap-3">
        <span className="meta-label" style={{ color: 'var(--color-ember)' }}>
          {chapter.kicker}
        </span>
        <h2 className="text-[24px] font-medium leading-tight tracking-tight text-bone min-[560px]:text-[28px]">
          {chapter.title}
        </h2>
        <p className="max-w-2xl text-[14px] leading-relaxed text-bone-dim">{chapter.body}</p>
      </div>

      {/* nav */}
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-hairline pt-5">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="mono border border-border px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:border-bone-dim hover:text-bone disabled:opacity-30"
        >
          ← Back
        </button>
        {i < last ? (
          <button
            type="button"
            onClick={() => go(i + 1)}
            className="mono border border-border bg-panel px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bone transition-colors hover:border-ember hover:text-ember"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={onExplore}
            className="mono border px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors"
            style={{ borderColor: 'var(--color-ember)', color: 'var(--color-ember)' }}
          >
            Explore real transactions →
          </button>
        )}
      </div>
    </div>
  )
}
