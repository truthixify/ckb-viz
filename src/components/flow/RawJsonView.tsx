import { useState } from 'react'
import type { Transaction } from '@/domain/types'

/**
 * The normalized transaction as formatted JSON, for developers who want to grab
 * the decoded structure. bigints are serialized as decimal strings (shannons),
 * and the large inline-image data URI is omitted so the blob stays readable.
 * Collapsed by default; noise for most reads, useful for some.
 */
function toJson(transaction: Transaction): string {
  return JSON.stringify(
    transaction,
    (key, value) => {
      if (typeof value === 'bigint') return value.toString()
      if (key === 'imageDataUri') return '[omitted]'
      return value
    },
    2,
  )
}

export function RawJsonView({
  transaction,
  onCopy,
}: {
  transaction: Transaction
  onCopy: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const json = open ? toJson(transaction) : ''

  return (
    <div className="border-t border-hairline pt-5">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-bone-dim"
        >
          <span aria-hidden>{open ? '▾' : '▸'}</span>
          Raw JSON
        </button>
        <button
          type="button"
          onClick={() => onCopy(toJson(transaction))}
          className="mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ember"
          title="Copy the normalized transaction as JSON"
        >
          Copy JSON
        </button>
      </div>

      {open && (
        <pre className="well mono mt-4 max-h-[420px] overflow-auto p-4 text-[11px] leading-relaxed text-bone-dim">
          {json}
        </pre>
      )}
    </div>
  )
}
