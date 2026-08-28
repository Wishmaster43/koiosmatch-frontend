// One document row: icon, name/rename, "gekoppeld aan" chip, uploaded-by/when,
// type chip, and the edit/preview/remove icon trio. Extracted mechanically from
// DocumentsTab (§3 split trigger, 28-08) — no behavior/visual change.
import { useTranslation } from 'react-i18next'
import { Pencil, Eye, X } from 'lucide-react'
import { Caption } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { EntityDoc } from '@/hooks/useEntityDocuments'
import { DOC_GRID_COLUMNS, docKey, docUrl, splitExt } from '../hooks/documentsTabUtils'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

interface DocumentRowProps {
  doc: EntityDoc
  index: number
  selected: Set<string>
  toggleSelectedRow: (key: string) => void
  renamingId: string | number | null
  renameValue: string
  setRenamingId: (id: string | number | null) => void
  setRenameValue: (v: string) => void
  doRename: (d: EntityDoc, base: string) => void
  docColor: (type: string | undefined) => string
  docTypeLabel: (type: string) => string
  DocIcon: React.ComponentType<{ size?: number; color?: string }>
  formatDateTime: (v: string) => string
  preview: (d: EntityDoc) => void
  onDelete: (d: EntityDoc, index: number) => void
}

// One row in the document list, plus its inline-rename state.
export default function DocumentRow({
  doc: d, index: i, selected, toggleSelectedRow, renamingId, renameValue, setRenamingId,
  setRenameValue, doRename, docColor, docTypeLabel, DocIcon, formatDateTime, preview, onDelete,
}: DocumentRowProps) {
  const { t } = useTranslation('customers')
  const key = docKey(d, i)
  const downloadable = Boolean(docUrl(d))

  // Escape layer: cancels inline rename (one-stage).
  useEscapeLayer(renamingId === d.id, () => setRenamingId(null))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: DOC_GRID_COLUMNS, alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
      {/* Row checkbox — disabled while the doc has no downloadable url yet (pending upload). */}
      <input type="checkbox" aria-label={t('documents.selectOne', { name: d.name ?? d.file_name ?? '' })}
        checked={downloadable && selected.has(key)} disabled={!downloadable} onChange={() => toggleSelectedRow(key)}
        style={{ accentColor: 'var(--color-primary)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: docColor(d.type), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocIcon size={13} color="white" /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renamingId === d.id
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doRename(d, renameValue) }}
                  onBlur={() => doRename(d, renameValue)}
                  style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                <Caption style={{ flexShrink: 0 }}>{splitExt(String(d.name ?? d.file_name ?? '')).ext}</Caption>
              </div>
            : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
          }
          {/* DOCS-LOC-DEPT-1: "gekoppeld aan" soft-tint chip (§4) — department wins
              over location (the deepest level, mirrors CustomerDocument::levelContext()'s
              own priority); absent entirely for a company-level document. */}
          {(d.department_name ?? d.location_name) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
              padding: '1px 6px', borderRadius: 99, marginTop: 2,
              background: tintBg('var(--color-info)'), color: chipInk('var(--color-info)'),
              border: tintBorder('var(--color-info)') }}>
              {t('notes.linkedTo', { name: d.department_name ?? d.location_name })}
            </span>
          )}
          {/* Added by whom + when (shown when the backend provides them). */}
          {(() => {
            const by = (typeof d.uploaded_by === 'object' ? d.uploaded_by?.name : d.uploaded_by)
              ?? (typeof d.created_by === 'object' ? d.created_by?.name : d.created_by) ?? ''
            const when = d.uploaded_at ?? d.created_at
            if (!by && !when) return null
            return <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {by}{by && when ? ' · ' : ''}{when ? formatDateTime(when) : ''}
            </div>
          })()}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: tintBg(docColor(d.type)), color: chipInk(docColor(d.type)), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ? docTypeLabel(d.type) : '—'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
        <Caption style={{ whiteSpace: 'nowrap' }}>{d.size ?? ''}</Caption>
        {/* Row-action icon trio — the candidate drawer's twin DocumentRow.tsx
            already retired its own equivalent grid to an `auto` actions column
            (Danny 08-08, documentHelpers.ts:46-51), so this is no longer byte-
            identical to that row. The necessity here is THIS screen's fixed
            100px grid column (DOC_GRID_COLUMNS): 3× Button's sm footprint (28px)
            would overflow it, which today fits size text + 3 dense icons side
            by side. Widening this column to match the candidate twin is
            pending Danny's call. */}
        <div style={{ display: 'flex' }}>
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
          <button aria-label={t('common:edit')} onClick={() => { setRenamingId(d.id ?? null); setRenameValue(splitExt(String(d.name ?? d.file_name ?? '')).base) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
          <button aria-label={t('documents.preview')} onClick={() => preview(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
          <button aria-label={t('common:remove')} onClick={() => onDelete(d, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
        </div>
      </div>
    </div>
  )
}
