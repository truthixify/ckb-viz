import { Glyph } from './Glyph'

/**
 * Glyph + wordmark lockup. The wordmark is the tool name in Geist Mono,
 * uppercase and letter-spaced — treated as swappable per the brand notes.
 * Acts as the Home affordance: activating it returns to the empty state.
 */
export function BrandMark({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <Glyph size={26} />
      <span className="mono select-none text-[15px] font-medium uppercase tracking-[0.22em] text-bone">
        ckb-viz
      </span>
    </>
  )

  if (!onHome) {
    return <div className="flex items-center gap-2.5">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onHome}
      aria-label="ckb-viz — home"
      className="flex items-center gap-2.5 outline-offset-4"
    >
      {content}
    </button>
  )
}
