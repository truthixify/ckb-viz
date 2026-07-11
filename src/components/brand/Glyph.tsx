/**
 * The spine mark: two cells feed a central ember spine, two cells emerge —
 * the whole flow in one glyph. Single-colour capable; the ember spine is the
 * only functional colour that ever appears in the brand.
 */
export function Glyph({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="14.75" y="5" width="2.5" height="22" fill="var(--color-ember)" />
      <g fill="none" stroke="var(--color-bone)" strokeWidth="1.6">
        <rect x="3.6" y="9.4" width="3.6" height="3.6" />
        <rect x="3.6" y="19" width="3.6" height="3.6" />
        <rect x="24.8" y="9.4" width="3.6" height="3.6" />
        <rect x="24.8" y="19" width="3.6" height="3.6" />
        <path d="M7.2 11.2 C 11 11.2 11 13.2 14.75 13.2" />
        <path d="M7.2 20.8 C 11 20.8 11 18.8 14.75 18.8" />
        <path d="M17.25 13.2 C 21 13.2 21 11.2 24.8 11.2" />
        <path d="M17.25 18.8 C 21 18.8 21 20.8 24.8 20.8" />
      </g>
    </svg>
  )
}
