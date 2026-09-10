// The queued-files-to-upload card: per-file type pickers, an apply-to-all chip
// row, the optional "gekoppeld aan" level picker, and the upload/cancel actions.
// Extracted mechanically from DocumentsTab (§3 split trigger, 28-08) — no
// behavior/visual change; same props it used to read from local state.
import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import { Caption } from '@/components/ui/typography'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import type { PendingItem } from '../hooks/useDocumentUploadQueue'
import type { LookupOption } from '@/types/common'
import { pendingUploadTitle } from '@/components/drawer/pendingUploadTitle'
// DRY round 11, DOCS/DOCTABS: the tinted card frame, row wrappers, per-row type
// select, remove glyph and upload/cancel footer shared with the candidate
// drawer's twin PendingUploadQueue. The apply-to-all chip row stays local — it
// renders through ChipMultiSelect here, a different DOM than the candidate
// queue's DocTypeChipRow.
import {
  PendingUploadFrame, PendingUploadRows, PendingUploadRow,
  PendingUploadTypeSelect, PendingUploadRemoveButton, PendingUploadFooter,
} from '@/components/drawer/PendingUploadFrame'

interface PendingUploadCardProps {
  pending: PendingItem[]
  docTypes: LookupOption[]
  docTypeLabelBaseId: string
  setItemType: (idx: number, type: string) => void
  setAllTypes: (type: string) => void
  removePending: (idx: number) => void
  uploadAll: () => void
  cancelPending: () => void
  showLinkPicker: boolean
  uploadLink: string
  setUploadLink: (v: string) => void
  linkOptions: { value: string; label: string }[]
}

// Card shown above the document list while one or more files are queued but not yet uploaded.
export default function PendingUploadCard({
  pending, docTypes, docTypeLabelBaseId, setItemType, setAllTypes, removePending,
  uploadAll, cancelPending, showLinkPicker, uploadLink, setUploadLink, linkOptions,
}: PendingUploadCardProps) {
  const { t } = useTranslation('customers')

  return (
    <PendingUploadFrame title={pendingUploadTitle(pending, t('documents.pendingCount', { count: pending.length }))}>
      <Caption as="div" style={{ marginBottom: 6 }}>
        {pending.length > 1 ? t('documents.applyTypeToAll') : t('documents.docType')}
      </Caption>
      {/* Herhaal-audit r4 finding 10: the shared ChipMultiSelect atom (§4 tint +
          fontWeight 600 + a check mark — CHIP-CONTRAST-1's second signal) reused
          as a "pick one to apply to all" picker: its own "active" set never grows
          past the single type every queued item already shares. selectAll is
          switched off — "select all types" has no meaning here. */}
      <div style={{ marginBottom: 10 }}>
        <ChipMultiSelect options={docTypes} selectAll={false}
          values={pending.length > 0 && pending.every(p => p.type === pending[0].type) ? [pending[0].type] : []}
          onToggle={setAllTypes} ariaLabel={t('documents.applyTypeToAll')} />
      </div>
      {/* DOCS-LOC-DEPT-1: the "gekoppeld aan" level picker — applies to the WHOLE
          queued batch (a batch is normally meant for one place), unlike the
          per-file type select below. Hidden entirely once the scope is locked
          (ScopedDocumentsTab) or the customer has neither a location nor a
          department to link to (§3 — no dead-end picker). */}
      {showLinkPicker && (
        <div style={{ marginBottom: 10 }}>
          <Caption as="div" style={{ marginBottom: 6 }}>{t('documents.linkLevelLabel')}</Caption>
          <div style={{ width: 220 }}>
            <SelectMenu value={uploadLink} onChange={setUploadLink} options={linkOptions}
              placeholder={t('notes.linkLevelOptions.customer')} />
          </div>
        </div>
      )}
      {/* One compact row per queued file — its own type select + remove. */}
      <PendingUploadRows>
        {pending.map((item, idx) => (
          <PendingUploadRow key={idx} name={item.name} size={item.size}>
            <PendingUploadTypeSelect labelId={`${docTypeLabelBaseId}-${idx}`} label={t('documents.docTypeFor', { name: item.name })}
              value={item.type} onChange={v => setItemType(idx, v)} options={docTypes} />
            {/* Dense queue-row icon — mirrors the identical unconverted remove
                button in the candidate drawer's twin PendingUploadQueue.tsx. */}
            <PendingUploadRemoveButton onClick={() => removePending(idx)} ariaLabel={t('common:remove')} />
          </PendingUploadRow>
        ))}
      </PendingUploadRows>
      {/* Herhaal-audit r4 finding 2: this is the card's primary action, so it
          reads Button's own primary identity — a hand-painted inverse fill
          sitting next to a real Button (cancelPending below) is exactly the
          drift the audit closes. Wanting the inverse LOOK back is a Button
          variant to add once, in Button.tsx, never a loose fill in a tab. */}
      <PendingUploadFooter
        addLabel={pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('documents.add')}
        cancelLabel={t('drawer.cancel')}
        onAdd={uploadAll} onCancel={cancelPending}
      />
    </PendingUploadFrame>
  )
}
