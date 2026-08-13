import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Search, X } from 'lucide-react'
import type { VacancyDetail } from '@/types/vacancy'
import { useEntityDocuments } from '@/hooks/useEntityDocuments'
import { useDocumentTypes } from '@/lib/useDocumentTypes'
// House "+ action" trigger (V16, 05-08) — replaces the bare text+Plus link below;
// same click target (opens the hidden file input). `short` collapses the visible
// text to the house "Nieuw" word since this is a drawer SUB-TAB (DRAWER-ADD-SHORT-1).
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
// DOC-FILTER-PARITY-1 (08-08): the shared search-box + searchable TYPE filter
// combo the candidate documents section already has — reused here verbatim,
// never forked, so every documents drill-down reads the same (§3A).
import DrawerFilterMenu from '@/components/drawer/DrawerFilterMenu'
import type { DrawerFilterConfig } from '@/components/drawer/DrawerFilterMenu'

// A picked-but-not-yet-uploaded file, staged so its type can be chosen first.
interface PendingDoc { file: File; objectUrl: string; name: string; size: string; type: string }

/**
 * DocumentsTab — list + upload + delete for a vacancy's documents. Data + persistence
 * live in useEntityDocuments (G-4): the list loads from /vacancies/{id}/documents and
 * upload/delete are optimistic. The link opens the signed download_url (or the local
 * blob for a not-yet-uploaded row). Mirrors the customer DocumentsTab, lean.
 *
 * DOCTYPE-VACANCY-1 (audit finding, 05-08): uploads used to always POST an empty
 * `type` — the tenant document-type lookup, scoped 'vacancy' (DOCTYPE-ENTITY-1), now
 * offers a soft-tint chip picker before the upload confirms, and each row shows its
 * resolved type. Kept to ONE queued file at a time — this tab never supported a
 * multi-pick queue, unlike the customer tab's richer multi-file version.
 */
export default function DocumentsTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const { docs, loading, error, upload, remove } = useEntityDocuments('vacancies', v.id)
  // Vacancy's own document-type lookup (entity-scoped) — never a hardcoded list.
  const { types: docTypes, labelOf: docTypeLabel, colorOf: docColor } = useDocumentTypes('vacancy')
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingDoc | null>(null)
  // DOC-FILTER-PARITY-1: free-text search (name + type) and the type filter, mirroring
  // the candidate documents section's own filtering exactly.
  const [docSearch, setDocSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  // Tracks the blob: URL of the currently staged preview, so it can be revoked when
  // replaced/cancelled/uploaded and on unmount — mirrors EntityHeader's PhotoAvatar /
  // useProfileForm fix (same class of leak: a preview created with URL.createObjectURL
  // that only ever got revoked on the happy "cancel" path, never on replace or unmount).
  const pendingUrlRef = useRef<string | null>(null)

  // Revoke a still-staged preview on unmount (drawer closed with a queued, unconfirmed
  // file) — reads the ref at cleanup time, so it always sees the latest staged URL.
  useEffect(() => () => { if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current) }, [])

  // Stage the picked file instead of uploading it blind — default type = the
  // tenant's first configured value, so the chip row always shows a selection.
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke the previous staged preview (if any) before replacing it — picking again
    // without confirming/cancelling first used to leak the earlier blob URL.
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    pendingUrlRef.current = objectUrl
    setPending({ file, objectUrl, name: file.name, size: Math.round(file.size / 1024) + ' KB', type: docTypes[0]?.value ?? '' })
    e.target.value = ''
  }
  // Confirm the staged file — upload with its picked type, then clear the queue.
  // Ownership of the object URL passes to useEntityDocuments (it revokes it once the
  // server doc replaces the optimistic row), so the ref is cleared WITHOUT revoking here.
  const confirmUpload = () => {
    if (!pending) return
    upload(pending.file, pending.type, pending.name, pending.objectUrl)
    pendingUrlRef.current = null
    setPending(null)
  }
  // Cancel discards the queued file and revokes its blob preview URL.
  const cancelUpload = () => {
    if (pending) URL.revokeObjectURL(pending.objectUrl)
    pendingUrlRef.current = null
    setPending(null)
  }

  // DOC-FILTER-PARITY-1: search matches name + type; the type filter narrows further —
  // mirrors the candidate documents section's own filtering logic exactly.
  const filteredDocs = docs.filter(d =>
    (!docSearch || (d.name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase())) &&
    (!docTypeFilter || (d.type ?? '') === docTypeFilter),
  )
  // The type filter row, behind the shared DrawerFilterMenu — self-hides when the
  // tenant has no document types configured (DrawerFilterMenu renders null on empty).
  const filterRows: DrawerFilterConfig[] = docTypes.length > 0 ? [{
    type: 'single', key: 'docType', label: t('documents.type'), value: docTypeFilter, onChange: setDocTypeFilter,
    allLabel: t('documents.allTypes'),
    options: docTypes.map(dt => ({ value: String(dt.value ?? ''), label: docTypeLabel(String(dt.value ?? '')) })),
  }] : []

  return (
    <div>
      {/* DOC-FILTER-PARITY-1: no more inline section title (the drawer's own tab bar
          already labels this tab "Documents", so a duplicate title read as clutter —
          mirrors the customer DocumentsTab, which dropped it for the same reason).
          Search grows on the left; the filter menu and Add button sit flush right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', flex: 1, minWidth: 0 }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder={t('documents.search')}
            style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none', flex: 1, minWidth: 0 }} />
          {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
        </div>
        <DrawerFilterMenu filters={filterRows}
          label={t('common:filters.button')} title={t('common:filters.title')} clearAllLabel={t('common:filters.clearAll')} />
        {/* V16 (05-08): was a bare label/link over the hidden file input — no real
            button semantics. The house control keeps the same click target (the
            hidden <input type="file"> below) and the full "Add" label as its
            title/aria-label, short-form visible text per the sub-tab rule. */}
        <DrawerAddButton onClick={() => fileRef.current?.click()} label={t('common:add')} short />
      </div>

      {pending && (
        <div style={{ border: '1px solid var(--color-primary)', borderRadius: 8, padding: 10, marginBottom: 8, background: 'var(--color-primary-bg)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {pending.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending.size})</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('documents.docType')}</div>
          {/* Soft-tint type chips (§4) — mirrors the customer DocumentsTab's picker. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {docTypes.map(dt => {
              const active = pending.type === dt.value
              return (
                <button key={dt.value} onClick={() => setPending(p => (p ? { ...p, type: dt.value } : p))}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: active ? 600 : 400,
                    border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                    background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--surface)',
                    color: active ? 'var(--color-primary)' : 'var(--text)' }}>{dt.label}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* CONTRAST-YELLOW-1 (08-08 audit): the fill is var(--text), which flips
                near-black↔near-white across themes, so the label must flip with it —
                var(--bg) is always the readable inverse of --text in both themes. */}
            <button onClick={confirmUpload}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, background: 'var(--text)', color: 'var(--bg)', border: 'none', cursor: 'pointer' }}>
              {t('common:add')}
            </button>
            <button onClick={cancelUpload}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
          </div>
        </div>
      )}

      {/* L8-docs-1: four explicit UI states (§3) — loading/error/empty/success,
          a failed fetch must never silently read as "no documents". */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.loading')}</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('documents.loadFailed')}</div>
      ) : docs.length === 0 && !pending ? (
        // DOC-FILTER-PARITY-1: fixes a copy-paste bug — this used to read the
        // APPLICANTS empty-state key ("No applications yet."), not a documents one.
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.empty')}</div>
      ) : filteredDocs.length === 0 ? (
        // A filter/search with zero matches is distinct from "no documents at all".
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('documents.noResults')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredDocs.map((d, i) => {
            const href = d.download_url ?? d.objectUrl
            return (
              <div key={String(d.id ?? i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {/* Canon (05-08): 12px, matching the customer DocumentsTab's own file-name convention. */}
                {href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--color-primary-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</a>
                  : <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>}
                {/* Soft-tint type chip (§4) — same convention as the customer tab's row badge. */}
                {d.type && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', background: docColor(d.type) + '18', color: docColor(d.type) }}>
                    {docTypeLabel(d.type)}
                  </span>
                )}
                {d.size && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.size}</span>}
                <button onClick={() => remove(d.id)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}><X size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPick} />
    </div>
  )
}
