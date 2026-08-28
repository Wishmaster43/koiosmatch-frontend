// The queued-files-to-upload card: per-file type pickers, an apply-to-all chip
// row, the optional "gekoppeld aan" level picker, and the upload/cancel actions.
// Extracted mechanically from DocumentsTab (§3 split trigger, 28-08) — no
// behavior/visual change; same props it used to read from local state.
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import type { PendingItem } from '../hooks/useDocumentUploadQueue'
import type { LookupOption } from '@/types/common'

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
    <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        {/* Single file keeps the old name+size header; a multi-pick shows a count instead. */}
        {pending.length === 1
          ? <>{pending[0].name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending[0].size})</span></>
          : t('documents.pendingCount', { count: pending.length })}
      </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {pending.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <Caption style={{ flexShrink: 0 }}>{item.size}</Caption>
            <span id={`${docTypeLabelBaseId}-${idx}`} className="sr-only">{t('documents.docTypeFor', { name: item.name })}</span>
            <div style={{ width: 130, flexShrink: 0 }}>
              <SelectMenu aria-labelledby={`${docTypeLabelBaseId}-${idx}`} value={item.type} onChange={v => setItemType(idx, v)}
                options={docTypes} menuWidth={160}
                style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
            </div>
            {/* Dense queue-row icon — mirrors the identical unconverted remove
                button in the candidate drawer's twin PendingUploadQueue.tsx
                (out of this task's scope); Button's smallest footprint (28px)
                would tower over this 12px icon in a tightly packed row. Block
                form: the flagged style attribute sits on the tag's 2nd line. */}
            {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- see comment above */}
            <button onClick={() => removePending(idx)} aria-label={t('common:remove')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}><X size={12} /></button>
            {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Herhaal-audit r4 finding 2: this is the card's primary action, so it
            reads Button's own primary identity — a hand-painted inverse fill
            sitting next to a real Button (cancelPending below) is exactly the
            drift the audit closes. Wanting the inverse LOOK back is a Button
            variant to add once, in Button.tsx, never a loose fill in a tab. */}
        <Button variant="primary" size="sm" onClick={uploadAll}>
          {pending.length > 1 ? t('documents.addAll', { count: pending.length }) : t('documents.add')}
        </Button>
        <Button variant="secondary" size="sm" onClick={cancelPending}>{t('drawer.cancel')}</Button>
      </div>
    </div>
  )
}
