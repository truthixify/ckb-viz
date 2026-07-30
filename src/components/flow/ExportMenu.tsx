import { useEffect, useRef, useState } from 'react'
import type { CapacityBreakdown, Transaction } from '@/domain/types'
import { buildFlowSvg } from '@/export/flowSvg'

/**
 * Export the flow as a self-contained image (SPEC §9.11). SVG is a direct Blob
 * download; PNG rasterizes the same SVG through a canvas via a data: URI (which
 * the strict CSP allows and which, unlike a blob URL, does not taint the
 * canvas). No external host is ever contacted.
 */
export function ExportMenu({
  transaction,
  capacity,
  onDone,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  onDone: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const baseName = `ckb-viz-${transaction.hash.slice(2, 12) || 'tx'}`

  const download = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSvg = () => {
    const svg = buildFlowSvg(transaction, capacity)
    download(new Blob([svg], { type: 'image/svg+xml' }), 'svg')
    setOpen(false)
    onDone('Flow exported as SVG')
  }

  const exportPng = (scale: number) => {
    const svg = buildFlowSvg(transaction, capacity)
    const widthMatch = svg.match(/width="(\d+)"/)
    const heightMatch = svg.match(/height="(\d+)"/)
    const w = Number(widthMatch?.[1] ?? 1100)
    const h = Number(heightMatch?.[1] ?? 600)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        onDone('Could not render the PNG')
        return
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) download(blob, 'png')
        onDone(blob ? `Flow exported as PNG (${scale}x)` : 'Could not render the PNG')
      }, 'image/png')
    }
    img.onerror = () => onDone('Could not render the PNG')
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="mono flex items-center gap-1.5 border border-hairline bg-panel px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ember hover:text-ember"
      >
        <span aria-hidden>↧</span> Export
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 flex min-w-[140px] flex-col border border-border bg-panel-2 py-1"
        >
          <MenuItem label="SVG" onClick={exportSvg} />
          <MenuItem label="PNG · 1×" onClick={() => exportPng(1)} />
          <MenuItem label="PNG · 2×" onClick={() => exportPng(2)} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="mono px-3 py-2 text-left text-[11px] uppercase tracking-[0.12em] text-bone-dim transition-colors hover:bg-raised hover:text-ember"
    >
      {label}
    </button>
  )
}
