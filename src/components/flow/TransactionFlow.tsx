import { useState } from 'react'
import type { CapacityBreakdown, Cell, Transaction } from '@/domain/types'
import { clsx } from '@/app/clsx'
import { ExportMenu } from './ExportMenu'
import { FlowCanvas } from './FlowCanvas'
import { OwnerNetView } from './OwnerNetView'

type FlowMode = 'flow' | 'owners'

/**
 * The transaction flow area: two views of the same transaction. "Cell flow" is
 * the input→output cell diagram; "Owner net" groups the cells by their owner
 * and shows who gained and lost what. The toggle reads them as one thing seen
 * two ways, not two separate pages.
 */
export function TransactionFlow({
  transaction,
  capacity,
  selectedId,
  onSelectCell,
  onCopy,
  onToast,
}: {
  transaction: Transaction
  capacity: CapacityBreakdown
  selectedId: string | null
  onSelectCell: (cell: Cell, id: string) => void
  onCopy: (text: string) => void
  onToast: (message: string) => void
}) {
  const [mode, setMode] = useState<FlowMode>('flow')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 border border-hairline bg-panel p-0.5" role="tablist" aria-label="Flow view">
          <ModeTab label="Cell flow" active={mode === 'flow'} onClick={() => setMode('flow')} />
          <ModeTab label="Owner net" active={mode === 'owners'} onClick={() => setMode('owners')} />
        </div>
        <ExportMenu transaction={transaction} capacity={capacity} onDone={onToast} />
      </div>

      {mode === 'flow' ? (
        <FlowCanvas
          transaction={transaction}
          capacity={capacity}
          selectedId={selectedId}
          onSelectCell={onSelectCell}
          onCopy={onCopy}
        />
      ) : (
        <OwnerNetView
          transaction={transaction}
          capacity={capacity}
          selectedId={selectedId}
          onSelectCell={onSelectCell}
          onCopy={onCopy}
        />
      )}
    </div>
  )
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'mono px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors',
        active ? 'bg-raised text-ember' : 'text-muted hover:text-bone-dim',
      )}
    >
      {label}
    </button>
  )
}
