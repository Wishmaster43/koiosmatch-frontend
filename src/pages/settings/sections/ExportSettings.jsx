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
import {
  Upload, Users, ClipboardList, Briefcase, Target, Building2,
  MapPin, Building, Handshake, ListChecks, PhoneCall, CalendarDays,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/notify'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { PageTitle } from '@/components/ui/typography'

// Entity → icon + its export route + the view-permission that gates it (mirrors
// routes/api/tenant/exports.php exactly). "Leads" = candidates in a Lead phase,
// not a separate resource, so it reuses candidates.view. Icons mirror how each
// entity is iconified elsewhere in the app: matches/tasks/opportunities/outreach
// from Sidebar.jsx NAV_ITEMS; contacts/locations/departments from their customer-drawer
// row icon + Add<Entity>Modal header (ContactsPanel.tsx/AddContactPersonModal.tsx,
// LocationsTab.tsx/AddLocationModal.tsx, DepartmentsPanel.tsx/AddDepartmentModal.tsx).
const ENTITIES = [
  { id: 'candidates', icon: Users, base: '/exports/candidates', permission: 'candidates.view' },
  { id: 'applications', icon: ClipboardList, base: '/exports/applications', permission: 'applications.view' },
  { id: 'vacancies', icon: Briefcase, base: '/exports/vacancies', permission: 'vacancies.view' },
  { id: 'leads', icon: Target, base: '/exports/leads', permission: 'candidates.view' },
  { id: 'customers', icon: Building2, base: '/exports/customers', permission: 'customers.view' },
  // EXPORT-UITBREIDEN-1 (CMFE 2026-07-28): the seven routes the backend added today.
  { id: 'contacts', icon: Users, base: '/exports/contacts', permission: 'customers.view' },
  { id: 'locations', icon: MapPin, base: '/exports/locations', permission: 'customers.view' },
  { id: 'departments', icon: Building, base: '/exports/departments', permission: 'customers.view' },
  { id: 'matches', icon: Handshake, base: '/exports/matches', permission: 'matches.view' },
  { id: 'tasks', icon: ListChecks, base: '/exports/tasks', permission: 'tasks.view' },
  { id: 'opportunities', icon: Target, base: '/exports/opportunities', permission: 'opportunities.view' },
  { id: 'outreach', icon: PhoneCall, base: '/exports/outreach', permission: 'outreach.view' },
  // FORMATEN-schijf (31-08): appointments export is new; an appointment is
  // candidate-dossier data, so it rides candidates.view (CMBE-measured — no
  // appointments.view right exists).
  { id: 'appointments', icon: CalendarDays, base: '/exports/appointments', permission: 'candidates.view' },
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
function fallbackFilename(entityId, ext) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${entityId}-${stamp}.${ext}`
}

/**
 * Stream one entity's CSV export to disk via a temporary object URL — a real
 * GET through the shared axios client (cookie + CSRF already attached), never a
 * bare `<a href>` navigation (that would skip the client's auth handling).
 */
export async function downloadCsv(route, entityId) {
  const res = await api.get(route, { responseType: 'blob' })
  // FORMATEN (31-08): the same helper streams both twins — extension follows the route.
  const ext = route.endsWith('.xlsx') ? 'xlsx' : 'csv'
  const filename = parseFilename(res.headers?.['content-disposition']) ?? fallbackFilename(entityId, ext)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Per-entity CSV export screen, each button gated on the same view-permission its list uses since exporting is bulk reading (see file header).
export default function ExportSettings() {
  const { t } = useTranslation('settings')
  const { hasPermission } = useAuth()
  const [selected, setSelected] = useState(ENTITIES[0].id)
  const [pendingId, setPendingId] = useState(null)

  // Trigger one entity's export; a 429 (rate limit) gets its own message, any
  // other failure a generic one — never a raw server string (§10).
  // One handler for both format twins (identical permissions, extension differs).
  const handleExport = async (entity, ext) => {
    setPendingId(`${entity.id}.${ext}`)
    try {
      await downloadCsv(`${entity.base}.${ext}`, entity.id)
    } catch (err) {
      notifyError(t(err?.response?.status === 429 ? 'export.rateLimited' : 'export.error'))
    } finally {
      setPendingId(null)
    }
  }

  const entity = ENTITIES.find(e => e.id === selected) ?? ENTITIES[0]
  const Icon = entity.icon
  const pendingCsv = pendingId === `${entity.id}.csv`
  const pendingXlsx = pendingId === `${entity.id}.xlsx`
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
                       // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                       color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
              <EIcon size={14} style={{ color: active ? 'var(--color-primary-text)' : 'var(--text-muted)' }} />
              {t(`export.entities.${e.id}.title`)}
            </button>
          )
        })}
      </div>

      {/* Content — header + a card whose action sits on the right (mirrors Importeren). */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <PageTitle>{t('export.title')}</PageTitle>
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
            {/* FORMATEN (Danny 31-08 "csv en xlsx voor alles"): twin buttons, same gate. */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="primary"
                onClick={() => handleExport(entity, 'csv')}
                disabled={!allowed || pendingCsv || pendingXlsx}
                title={allowed ? t('export.formatCsv') : t('export.noPermission')}>
                {pendingCsv ? <Spinner size={14} /> : <Upload size={14} />}
                {t('export.formatCsv')}
              </Button>
              <Button variant="secondary"
                onClick={() => handleExport(entity, 'xlsx')}
                disabled={!allowed || pendingCsv || pendingXlsx}
                title={allowed ? t('export.formatXlsx') : t('export.noPermission')}>
                {pendingXlsx ? <Spinner size={14} /> : <Upload size={14} />}
                {t('export.formatXlsx')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
