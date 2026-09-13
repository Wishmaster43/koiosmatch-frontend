/**
 * EmailLog — Settings → Communicatie → E-mail-log: incoming and outgoing e-mail,
 * linked to the candidate or customer it belongs to. Built on the shared LogView.
 * Degrades gracefully: the screen stays empty until the backend serves `/email-log`
 * (a message log carrying direction, from/to, subject, entity and status).
 *
 * DL-05: the list is server-paginated (GET /email-log?page&per_page, direction as
 * a server param) via the shared PaginationBar/unwrapList — the old version fetched
 * page 1 only and silently truncated the audit surface. Free-text search stays
 * client-side over the currently loaded page only (no server search param exists
 * on this endpoint yet — see the searchHint below).
 * DL-04: the row detail lazily fetches GET /email-log/{id} (the list response never
 * carries `body`, by backend design) and swallows 403/404 instead of surfacing an
 * error state — a settings.view-only caller legitimately gets 403 on an
 * entity-linked mail while the row itself is still listed to them.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { AxiosError } from 'axios'
import { X } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import Button from '@/components/ui/Button'
import LogView from '@/components/ui/LogView'
import type { LogExportCol } from '@/components/ui/LogView'
import PaginationBar from '@/components/ui/PaginationBar'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { DirectionPill, StatusPill, isInbound } from '@/components/ui/logChips'
import type { Column } from '@/components/ui/DataTable'

interface EmailLogEntry {
  id?: string | number
  direction?: string
  from?: string
  to?: string
  subject?: string
  entity_type?: string
  entity_id?: string | number
  entity_label?: string
  status?: string
  created_at?: string
  body?: string
  [k: string]: unknown
}

const PER_PAGE = 50
const PAGE_SIZE_OPTIONS = [50, 100, 200] // backend MAX_PER_PAGE is 200 (422 above it)

const entityText = (e: EmailLogEntry, t: TFunction<'settings'>) =>
  e.entity_label ?? (e.entity_type ? t(`audit.entity.${e.entity_type.split('\\').pop()?.toLowerCase()}`, { defaultValue: e.entity_type }) : '—')

// True when an axios error carries a 403 or 404 — a settings.view-only caller
// legitimately gets 403 on an entity-linked mail's body (EmailLogEntityGateTest),
// while the row itself is still listed with from/to/subject masked.
const isAccessDenied = (err: unknown): boolean => {
  const status = (err as AxiosError)?.response?.status
  return status === 403 || status === 404
}

// Detail panel for one logged e-mail — lazily fetches the (encrypted) body via
// GET /email-log/{id}, since the list response never carries it (DL-04).
function EmailLogDrawer({ entry, onClose }: { entry: EmailLogEntry; onClose: () => void }) {
  const { t } = useTranslation('settings')
  // App-wide active locale (§5) — formatDateTime replaces the old hardcoded 'nl-NL' fmt().
  const { formatDateTime } = useDateFormat()
  // Single-source dialog behaviour (Escape + Tab-trap + focus restore) via the
  // shared useFocusTrap, instead of a hand-rolled document-level Escape listener.
  const trapRef = useFocusTrap<HTMLDivElement>(onClose)
  const [body, setBody] = useState<string | null>(null)
  const [bodyLoading, setBodyLoading] = useState(true)
  const [bodyError, setBodyError] = useState(false)

  // Lazy body fetch, scoped to the entity link when the row carries one (tightens
  // the IDOR scope, mirrors pages/opportunities/drawer/EmailTab.tsx). A 403/404 is
  // an expected access boundary here, never a broken drawer — swallow it silently
  // and simply omit the body section. Any OTHER failure (500, network) is a real
  // fetch problem and surfaces a short error line instead of a silent blank panel.
  useEffect(() => {
    let alive = true
    setBodyLoading(true)
    setBody(null)
    setBodyError(false)
    const params = entry.entity_type && entry.entity_id != null
      ? { entity_type: entry.entity_type, entity_id: entry.entity_id }
      : undefined
    api.get(`/email-log/${entry.id}`, { params })
      .then(r => { if (alive) setBody(unwrap<EmailLogEntry>(r)?.body ?? null) })
      .catch(err => {
        if (!alive) return
        if (isAccessDenied(err)) return /* silent: omit the body section, a real access boundary */
        setBodyError(true)
      })
      .finally(() => { if (alive) setBodyLoading(false) })
    return () => { alive = false }
  }, [entry.id, entry.entity_type, entry.entity_id])

  const rows: Array<[string, string]> = [
    [t('log.direction'), isInbound(entry.direction) ? t('log.in') : t('log.out')],
    [t('emailLog.from'), entry.from ?? '—'],
    [t('emailLog.to'), entry.to ?? '—'],
    [t('emailLog.subject'), entry.subject ?? '—'],
    [t('audit.colEntity'), entityText(entry, t)],
    [t('log.status'), entry.status ?? '—'],
    [t('log.date'), formatDateTime(entry.created_at)],
  ]
  return (
    <>
      {/* SETTINGS-INCON-B2 (13-09): right-anchored slide-in drawer, same family as
          RightDrawer — not a pop-up, so it stays off FloatingPanel (see the task
          audit's inventory for the reasoning). */}
      <div className="fixed inset-0" style={{ zIndex: 'var(--z-drawer)', background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={entry.subject || t('emailLog.title')} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col" style={{ zIndex: 'var(--z-drawer)', width: 460, background: 'var(--surface)', boxShadow: 'var(--shadow-drawer)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{entry.subject || t('emailLog.title')}</span>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')} title={t('common:close')}><X size={16} /></Button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 16px', marginBottom: 16 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
              </div>
            ))}
          </div>
          {bodyLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={12} /> <Caption as="span">{t('emailLog.bodyLoading')}</Caption>
            </div>
          )}
          {!bodyLoading && bodyError && (
            <Caption as="div" style={{ color: 'var(--color-danger-text)' }}>{t('emailLog.bodyError')}</Caption>
          )}
          {!bodyLoading && body && (
            <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', background: 'var(--hover-bg)', borderRadius: 8, padding: '12px 14px' }}>
              {body}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Settings → e-mail audit log: server-paginated table + search/direction filters + a row detail panel.
export default function EmailLog() {
  const { t } = useTranslation('settings')
  // App-wide active locale (§5) — formatDateTime replaces the old hardcoded 'nl-NL' fmt().
  const { formatDateTime } = useDateFormat()
  const [rows, setRows] = useState<EmailLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(PER_PAGE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedDir, setSelectedDir] = useState<string[]>([])
  const [selected, setSelected] = useState<EmailLogEntry | null>(null)

  // DL-05: load ONE page from the server, with direction as a real server param
  // (the endpoint validates direction|status|entity_type|entity_id|per_page — the
  // existing filter was running client-side over a truncated first page while the
  // server-side filter sat unused). Any load failure — 404 included — surfaces
  // LogView's error state, never a fake empty log. Reset to page 1 on a filter change.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    const params: Record<string, unknown> = { page, per_page: perPage }
    if (selectedDir.length === 1) params.direction = selectedDir[0] === 'in' ? 'inbound' : 'outbound'
    api.get('/email-log', { params })
      .then(r => {
        if (!alive) return
        const list = unwrapList<EmailLogEntry>(r)
        setRows(list.rows); setTotal(list.total); setLastPage(list.lastPage)
      })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, perPage, selectedDir])

  // A filter or page-size change resets to page 1 IN THE SAME update (never a second
  // effect: that fired one request with the stale page and one with page 1).
  const changeDir = (v: string) => { setSelectedDir(p => (p[0] === v ? [] : [v])); setPage(1) }
  const changePerPage = (n: number) => { setPerPage(n); setPage(1) }

  // Client-side search over the CURRENTLY LOADED PAGE ONLY — no server search
  // param exists on this endpoint yet (index() validates only
  // direction|status|entity_type|entity_id|per_page). Labelled as page-scoped
  // below (searchHint) so the audit surface never implies a full-log search.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(e => [e.from, e.to, e.subject, e.entity_label].some(v => (v ?? '').toLowerCase().includes(q)))
  }, [rows, search])

  const columns: Column<EmailLogEntry>[] = [
    { key: 'direction', header: t('log.direction'), width: 120, render: r => <DirectionPill direction={r.direction} /> },
    { key: 'party', header: t('emailLog.party'), render: r => (isInbound(r.direction) ? r.from : r.to) ?? '—' },
    { key: 'subject', header: t('emailLog.subject'), render: r => r.subject ?? '—' },
    { key: 'entity', header: t('audit.colEntity'), render: r => entityText(r, t) },
    { key: 'status', header: t('log.status'), width: 120, render: r => <StatusPill status={r.status} /> },
    { key: 'created_at', header: t('log.date'), width: 150, nowrap: true, render: r => formatDateTime(r.created_at) },
  ]

  // Builds the search + direction filter groups fed to the shared right panel.
  // Direction is a real server param now (single-select toggle, mirrors
  // WhatsAppLog): no per-option counts, since the loaded page is already
  // filtered server-side and a client-side count over it would misrepresent
  // the OTHER option's real total (DL-05: "drop the chip counters").
  const filterGroups = useMemo(() => [
    { key: 'search', label: t('emailLog.searchPlaceholder'), type: 'global-search', value: search, onChange: setSearch },
    { key: 'direction', label: t('log.direction'), type: 'search-select', selected: selectedDir,
      options: [{ value: 'in', label: t('log.in') }, { value: 'out', label: t('log.out') }],
      onToggle: changeDir },
  ], [t, search, selectedDir])

  const exportColumns: LogExportCol<EmailLogEntry>[] = [
    { header: t('log.direction'), value: r => isInbound(r.direction) ? t('log.in') : t('log.out') },
    { header: t('emailLog.party'), value: r => (isInbound(r.direction) ? r.from : r.to) ?? '' },
    { header: t('emailLog.subject'), value: r => r.subject ?? '' },
    { header: t('audit.colEntity'), value: r => entityText(r, t) },
    { header: t('log.status'), value: r => r.status ?? '' },
    { header: t('log.date'), value: r => formatDateTime(r.created_at) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <LogView<EmailLogEntry> rows={filtered} columns={columns} loading={loading} error={loadError ? t('emailLog.loadError') : null} filterKey="email-log"
          filterGroups={filterGroups} getRowId={r => r.id ?? ''} onRowClick={setSelected}
          exportName={`email-log-p${page}`} exportColumns={exportColumns} totalCount={total} emptyText={t('emailLog.empty')} />
      </div>
      {/* DL-05: the CSV only ever exports the loaded page — the filename says so. */}
      {!loading && !loadError && rows.length > 0 && (
        <>
          <Caption as="div" style={{ padding: '6px 0 0' }}>{t('emailLog.pageScopedHint')}</Caption>
          <PaginationBar page={page} totalPages={lastPage} totalRows={total} pageSize={perPage}
            onPageChange={setPage} onPageSizeChange={changePerPage} pageSizeOptions={PAGE_SIZE_OPTIONS} />
        </>
      )}
      {selected && <EmailLogDrawer entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
