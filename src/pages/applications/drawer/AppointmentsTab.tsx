/**
 * AppointmentsTab — the application's appointments (shared entity, B-17/C-22).
 * Reuses the SAME PlanIntakeModal as the candidate + vacancy drawers for both
 * create and edit (Danny 2026-07-13: one appointment experience everywhere — this
 * used to be a hand-rolled free-text composer showing raw ISO datetimes). Reads
 * straight from /candidates/{id}/appointments so it always reflects the shared
 * appointments entity, not a stale copy nested under the application.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Clock, User, MapPin, Pencil, Search } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useAppointmentTypes } from '@/lib/useAppointmentTypes'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Button from '@/components/ui/Button'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { SectionTitle } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'
import { PlanIntakeModal } from '@/pages/candidates/shared'
import type { ExistingAppointment } from '@/pages/candidates/shared'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// One row from GET /candidates/{id}/appointments — the shared appointments entity,
// filtered client-side to this application (that endpoint has no ?application_id filter).
interface RawAppt {
  id: Id; application_id?: Id | null; type?: string; scheduled_at?: string
  duration_min?: number | null; modality?: string
  owner?: { id?: Id; name?: string } | null
  location_name?: string | null; location_id?: Id | null; status?: string
}


// Lists this application's appointments straight from the shared appointments
// entity (see file docblock above), filtered client-side since the endpoint has
// no application_id filter; create/edit reuses PlanIntakeModal.
export default function AppointmentsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation(['applications', 'common'])
  // scheduled_at is a zoneless WALL time — the shared formatWallTime replaces the
  // former hand-pinned UTC dateTimeOpts (BUREAU-KLOK-FE-1: one idiom, not four).
  const { formatWallTime } = useDateFormat()
  const { metaOf } = useAppointmentTypes()

  const [appointments, setAppointments] = useState<RawAppt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  // The appointment being edited (pencil on a card) → prefilled shared modal → PATCH.
  const [editing, setEditing] = useState<ExistingAppointment | null>(null)

  // Load this candidate's appointments and keep only the ones linked to this application.
  // Request-id guarded (§9): `load` also re-runs as the PlanIntakeModal onCreated callback
  // (lines 144/188/192 below), so the effect-driven call and that callback's call can overlap
  // in flight — a per-call `alive` alone would NOT stop the older response from winning if it
  // lands last, since each invocation has its own closure. A shared ref counter tags each call
  // and only the response matching the LATEST tag is applied, so the last-fired call always wins.
  const requestIdRef = useRef(0)
  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    if (a.candidateId == null) { setAppointments([]); setLoading(false); return }
    setLoading(true); setLoadFailed(false)
    api.get(`/candidates/${a.candidateId}/appointments`, { quiet404: true })
      .then(r => {
        if (requestIdRef.current !== requestId) return
        const rows = (unwrapList(r).rows) as RawAppt[]
        setAppointments(rows.filter(ap => String(ap.application_id) === String(a.id)))
      })
      .catch(() => { if (requestIdRef.current === requestId) setLoadFailed(true) })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
  }, [a.candidateId, a.id])
  useEffect(() => { load() }, [load])

  // Search narrows on type label + owner + location, client-side (no BE filter param today).
  const [search, setSearch] = useState('')

  // Appointment status is a FIXED backend enum (App\Models\Appointment::STATUSES),
  // never a tenant lookup — so a local static option list drives the shared
  // presentational StatusFilterSelect instead of the tenant-lookup useStatusFilter path.
  const statusOptions = [
    { id: 'planned', value: 'planned', label: t('appointments.statuses.planned') },
    { id: 'completed', value: 'completed', label: t('appointments.statuses.completed') },
    { id: 'no_show', value: 'no_show', label: t('appointments.statuses.noShow') },
    { id: 'cancelled', value: 'cancelled', label: t('appointments.statuses.cancelled') },
  ]
  const { value: statusFilter, toggle: toggleStatus, filtered: byStatus } =
    useStatusFilter(appointments, statusOptions, ap => String(ap.status ?? ''))

  const q = search.trim().toLowerCase()
  const visible = q
    ? byStatus.filter(ap => [metaOf(ap.type)?.label ?? ap.type, ap.owner?.name, ap.location_name]
        .some(v => String(v ?? '').toLowerCase().includes(q)))
    : byStatus

  // New-appointment button — the house DrawerAddButton short (soft-tint primary),
  // disabled when the application has no candidate link.
  const newButton = (
    <DrawerAddButton onClick={() => setCreating(true)} disabled={a.candidateId == null}
      label={t('appointments.new')} short />
  )

  // Toolbar: search (left, growing) → status filter → add (right) — the house order (§4).
  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <Search size={13} color="var(--text-muted)" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('appointments.searchPlaceholder')} aria-label={t('appointments.searchPlaceholder')}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }} />
      </div>
      <StatusFilterSelect value={statusFilter} onToggle={toggleStatus} statuses={statusOptions} />
      {newButton}
    </div>
  )

  // Loading state.
  if (loading) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
  }

  // Error state — the shared appointments entity failed to load; offer a retry.
  if (loadFailed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 40, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>{t('appointments.loadError')}</span>
        <Button variant="secondary" onClick={load}>
          {t('common:error.retry')}
        </Button>
      </div>
    )
  }

  // Empty state (no appointments at all, not creating) — calm state with the CTA.
  // The toolbar still shows so search/filter stay reachable once appointments arrive.
  if (!appointments.length && !creating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {toolbar}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 52, textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Calendar size={22} style={{ opacity: 0.6 }} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('appointments.empty')}</div>
          <div style={{ fontSize: 12, marginTop: 4, maxWidth: 260 }}>{t('appointments.hint')}</div>
        </div>
        {creating && a.candidateId != null && (
          <PlanIntakeModal candidateId={a.candidateId} applicationId={a.id ?? null} defaultVacancyId={a.vacancyId} mode="appointment"
            onClose={() => setCreating(false)} onCreated={load} />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {toolbar}
      {visible.length === 0 && (
        <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('appointments.noMatches')}</div>
      )}
      {visible.map(ap => {
        const typeLabel = metaOf(ap.type)?.label ?? ap.type
        const statusLabel = statusOptions.find(s => s.value === ap.status)?.label ?? (ap.status || '—')
        return (
          <div key={ap.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <SectionTitle as="span">{typeLabel}</SectionTitle>
              <SoftChip label={statusLabel} color="var(--color-secondary)" round />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              {/* Wall-time DD-MM-YYYY HH:mm — the BE stores it in UTC as-entered, so no local-tz shift. */}
              {ap.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formatWallTime(ap.scheduled_at)}</span>}
              {ap.duration_min != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {t('appointments.durationMin', { count: ap.duration_min })}</span>}
              {ap.owner?.name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} /> {t('appointments.with')}: {ap.owner.name}</span>}
              {ap.location_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {ap.location_name}</span>}
              {/* Edit: opens the same shared modal, prefilled → PATCH. */}
              {a.candidateId != null && (
                <Button variant="secondary" size="sm" iconOnly style={{ marginLeft: 'auto' }}
                  onClick={() => setEditing({
                    id: ap.id, scheduled_at: ap.scheduled_at, duration_min: ap.duration_min, modality: ap.modality,
                    type: ap.type, owner_id: ap.owner?.id, location_id: ap.location_id ?? null,
                  })}
                  title={t('common:edit')} aria-label={t('common:edit')}>
                  <Pencil size={12} />
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {creating && a.candidateId != null && (
        <PlanIntakeModal candidateId={a.candidateId} applicationId={a.id ?? null} defaultVacancyId={a.vacancyId} mode="appointment"
          onClose={() => setCreating(false)} onCreated={load} />
      )}
      {editing && a.candidateId != null && (
        <PlanIntakeModal candidateId={a.candidateId} existing={editing} mode="appointment"
          onClose={() => setEditing(null)} onCreated={load} />
      )}
    </div>
  )
}
