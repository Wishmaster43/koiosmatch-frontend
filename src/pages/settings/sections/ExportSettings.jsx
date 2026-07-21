/**
 * ExportSettings — per-entity CSV export (Instellingen → Exporteren, EXPORT-CSV-1).
 * Layout deliberately mirrors ImporterenSettings.jsx 1:1 (header style, card style,
 * primary-button style, spacing) — only the content differs: five entity rows with
 * an "Export CSV" action instead of an import wizard (Danny/CMFE 2026-07-20:
 * consistency with the sibling Importeren screen wins over the reference mock).
 * The routes are live (koiosmatch-api commit 3a5f12c): GET /exports/{entity}.csv,
 * streamed + permission-gated + rate-limited (10/min) + audit-logged server-side.
 * Each button is gated on the SAME view-permission its list uses (least privilege —
 * exporting is bulk reading). `downloadCsv` is the real request logic, unit-tested
 * directly against the request shape (§13 — a mutation/read test proves the seam).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Users, ClipboardList, Briefcase, Target, Building2, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/notify'

// Entity → icon + its export route + the view-permission that gates it (mirrors
// routes/api/tenant/exports.php exactly). "Leads" = candidates in a Lead phase,
// not a separate resource, so it reuses candidates.view.
const ENTITIES = [
  { id: 'candidates', icon: Users, route: '/exports/candidates.csv', permission: 'candidates.view' },
  { id: 'applications', icon: ClipboardList, route: '/exports/applications.csv', permission: 'applications.view' },
  { id: 'vacancies', icon: Briefcase, route: '/exports/vacancies.csv', permission: 'vacancies.view' },
  { id: 'leads', icon: Target, route: '/exports/leads.csv', permission: 'candidates.view' },
  { id: 'customers', icon: Building2, route: '/exports/customers.csv', permission: 'customers.view' },
]

// Parse the filename the backend sets via Content-Disposition (Laravel's
// streamDownload default). Only visible on a same-origin response — the API's
// cors.php currently exposes no headers cross-origin (see Self-Audit) — so this
// is a "use it when present" nicety, never the only path to a filename.
function parseFilename(header) {
  if (!header) return null
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(header)
  return match ? decodeURIComponent(match[1]) : null
}

// Client-side fallback filename, matching the backend's OWN convention exactly
// (`{entity}-YYYY-MM-DD-HHmm.csv`, see ExportController::streamCsv).
function fallbackFilename(entityId) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${entityId}-${stamp}.csv`
}

/**
 * Stream one entity's CSV export to disk via a temporary object URL — a real
 * GET through the shared axios client (cookie + CSRF already attached), never a
 * bare `<a href>` navigation (that would skip the client's auth handling).
 */
export async function downloadCsv(route, entityId) {
  const res = await api.get(route, { responseType: 'blob' })
  const filename = parseFilename(res.headers?.['content-disposition']) ?? fallbackFilename(entityId)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ExportSettings() {
  const { t } = useTranslation('settings')
  const { hasPermission } = useAuth()
  const [selected, setSelected] = useState(ENTITIES[0].id)
  const [pendingId, setPendingId] = useState(null)

  // Trigger one entity's export; a 429 (rate limit) gets its own message, any
  // other failure a generic one — never a raw server string (§10).
  const handleExport = async (entity) => {
    setPendingId(entity.id)
    try {
      await downloadCsv(entity.route, entity.id)
    } catch (err) {
      notifyError(t(err?.response?.status === 429 ? 'export.rateLimited' : 'export.error'))
    } finally {
      setPendingId(null)
    }
  }

  const entity = ENTITIES.find(e => e.id === selected) ?? ENTITIES[0]
  const Icon = entity.icon
  const pending = pendingId === entity.id
  const allowed = hasPermission(entity.permission)

  // Master-detail, identical chrome to ImporterenSettings (Danny 21-07: same
  // format): a left entity sub-nav + a right panel whose card carries the action.
  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      {/* Sub-nav — one entity per row (mirrors Importeren's type list). */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 16, marginRight: 32 }}>
        {ENTITIES.map(e => {
          const EIcon = e.icon
          const active = e.id === selected
          return (
            <button key={e.id} onClick={() => setSelected(e.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                       borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                       fontWeight: active ? 600 : 400, marginBottom: 2,
                       background: active ? 'var(--color-primary-bg)' : 'transparent',
                       color: active ? 'var(--color-primary)' : 'var(--text)' }}>
              <EIcon size={14} style={{ color: active ? 'var(--color-primary)' : 'var(--text-muted)' }} />
              {t(`export.entities.${e.id}.title`)}
            </button>
          )
        })}
      </div>

      {/* Content — header + a card whose action sits on the right (mirrors Importeren). */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('export.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('export.subtitle')}</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
              <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t(`export.entities.${entity.id}.title`)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t(`export.entities.${entity.id}.desc`)}</div>
              </div>
            </div>
            <button
              onClick={() => handleExport(entity)}
              disabled={!allowed || pending}
              title={allowed ? t('export.button') : t('export.noPermission')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', fontSize: 13,
                fontWeight: 500, border: 'none', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
                background: 'var(--color-primary)', color: 'white',
                cursor: allowed && !pending ? 'pointer' : 'not-allowed',
                opacity: !allowed || pending ? 0.5 : 1,
              }}>
              {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} />}
              {t('export.button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
