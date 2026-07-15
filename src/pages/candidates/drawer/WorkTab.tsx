import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Plus, CalendarPlus, Calendar, Clock, User, Building2, Video, Phone, Pencil } from 'lucide-react'
import MatchesTab from './MatchesTab'
import StatusPill from '@/components/ui/StatusPill'
import AddApplicationModal from './AddApplicationModal'
import PlanIntakeModal from './PlanIntakeModal'
import type { ExistingAppointment } from './PlanIntakeModal'
import MatchPlacementModal from './MatchPlacementModal'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { sectionBlock } from './constants'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'
import { isSafeUrl } from '@/lib/safeUrl'

// A linked appointment as returned by /candidates/{id}/appointments.
interface Appt { id: Id; application_id?: Id | null; type?: string; scheduled_at?: string; duration_min?: number | null; modality?: string; owner?: { id?: Id; name?: string }; location_name?: string; status?: string }

// One application row as nested under the candidate (read defensively). The
// funnel stage (label + colour) used to live in the header chips — shown here now.
interface AppRow { id?: string; logo_url?: string; vacancy?: { logo_url?: string; title?: string; url?: string; id?: string }; vacature?: string; title?: string; url?: string; stageLabel?: string; stageColor?: string }

// The vacancy link, when the API exposes a URL; otherwise falls back to plain text.
// AUDIT-2: URLs are tenant-entered data — only http(s) may render as a link.
const vacancyUrlOf = (s: AppRow) => {
  const url = s.vacancy?.url ?? s.url ?? null
  return isSafeUrl(url) ? url : null
}

/** Work tab — matches + paginated applications, with the two candidate actions
 *  (§3B two-action model): couple to a vacancy, or plan an intake. */
export default function WorkTab({ c }: { c: Candidate }) {
  const { t } = useTranslation(['candidates', 'common'])
  const { formatDate, locale } = useDateFormat()
  // Local copy of the applications so a create shows immediately (re-fetched from
  // the candidate detail after a POST — the BE may add a vacancy-less intake row).
  const [apps, setApps] = useState<AppRow[]>((c.applications ?? []) as unknown as AppRow[])
  // Appointments (who/when/where) keyed by application_id — shown under each row.
  const [appts, setAppts] = useState<Appt[]>([])
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<null | 'apply' | 'intake' | 'match'>(null)
  // The appointment being edited (pencil on the appointment line) → prefilled intake modal.
  const [editAppt, setEditAppt] = useState<ExistingAppointment | null>(null)
  // Reset the local list when the drawer switches to another candidate / fuller detail.
  useEffect(() => { setApps((c.applications ?? []) as unknown as AppRow[]); setPage(1) }, [c.id, c.applications])
  // Load the candidate's appointments once per candidate (separate structured entity).
  useEffect(() => {
    let alive = true
    api.get(`/candidates/${c.id}/appointments`, { quiet404: true })
      .then(r => { if (alive) setAppts((unwrapList(r).rows) as Appt[]) })
      .catch(() => {})
    return () => { alive = false }
  }, [c.id])

  // Re-fetch applications + appointments after a create so both show immediately.
  const reload = async () => {
    try {
      const [detail, ap] = await Promise.all([
        api.get(`/candidates/${c.id}`),
        api.get(`/candidates/${c.id}/appointments`, { quiet404: true }),
      ])
      const fresh = (unwrap(detail)) as { applications?: AppRow[] }
      setApps((fresh?.applications ?? []) as AppRow[]); setPage(1)
      setAppts((unwrapList(ap).rows) as Appt[])
    } catch { /* keep the current lists on a failed refresh */ }
  }

  // Icon per modality (office/remote/phone) for the appointment line.
  const ModalityIcon = ({ m }: { m?: string }) => m === 'remote' ? <Video size={11} /> : m === 'phone' ? <Phone size={11} /> : <Building2 size={11} />
  // The appointment linked to an application row (by application_id).
  const apptFor = (appId?: Id | null) => appId != null ? appts.find(a => String(a.application_id) === String(appId)) : undefined
  // "09:00–09:30" from scheduled_at + duration_min. The BE stores the wall time the
  // user entered as UTC, so this MUST read it back as UTC — Date's local getters
  // would shift it (+2h in Europe/Amsterdam) instead of showing the entered time.
  const timeRange = (a: Appt) => {
    if (!a.scheduled_at) return ''
    const start = new Date(a.scheduled_at)
    const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    if (!a.duration_min) return hhmm(start)
    const end = new Date(start.getTime() + a.duration_min * 60000)
    return `${hhmm(start)}–${hhmm(end)}`
  }

  const PER = 5
  const pages = Math.max(1, Math.ceil(apps.length / PER))
  const slice = apps.slice((page - 1) * PER, page * PER)

  // Shared soft-button style for the two header actions.
  const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', fontSize: 11.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer', color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MatchesTab c={c} />
      <div>
        {/* Applications header: count on the left, the two actions on the right. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {t('sections.applications')} <span style={{ fontWeight: 400 }}>{apps.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModal('match')} style={actionBtn}><Plus size={12} /> {t('work.addMatch')}</button>
            <button onClick={() => setModal('apply')} style={actionBtn}><Plus size={12} /> {t('work.addApplication')}</button>
            <button onClick={() => setModal('intake')} style={actionBtn}><CalendarPlus size={12} /> {t('work.planIntake')}</button>
          </div>
        </div>
        <div style={sectionBlock}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('work.vacancy')}</div>
          {slice.length === 0
            ? <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.applicationsEmpty')}</div>
            : slice.map((s, i) => {
              // Vacancy-less intake applications have no title → show a dash (CONSIST-2).
              const label = s.vacature ?? s.vacancy?.title ?? s.title ?? '—'
              const url = vacancyUrlOf(s)
              const appt = apptFor(s.id)
              return (
              <div key={i} style={{ borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', fontSize: 12, color: 'var(--text)' }}>
                  {(s.logo_url ?? s.vacancy?.logo_url) && <img src={s.logo_url ?? s.vacancy?.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />}
                  {/* Vacancy name links out to the vacancy when the API gives a URL. */}
                  {url
                    ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-primary)', textDecoration: 'none' }}>{label}</a>
                    : <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
                  {s.stageLabel && <StatusPill label={s.stageLabel} color={s.stageColor} />}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" title={t('work.openVacancy')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {/* Linked appointment: date · start–end · modality · owner (CONSIST-2 / APPT). */}
                {appt && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '0 12px 10px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                    {appt.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {formatDate(appt.scheduled_at, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>}
                    {appt.scheduled_at && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {timeRange(appt)}{appt.duration_min ? ` · ${appt.duration_min} min` : ''}</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ModalityIcon m={appt.modality} /> {t(`work.modality${appt.modality === 'remote' ? 'Remote' : appt.modality === 'phone' ? 'Phone' : 'Office'}`)}{appt.location_name ? ` · ${appt.location_name}` : ''}</span>
                    {appt.owner?.name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {appt.owner.name}</span>}
                    {/* Pencil: edit this intake appointment (Danny) — prefilled modal → PATCH. */}
                    <button onClick={() => setEditAppt({ id: appt.id, scheduled_at: appt.scheduled_at, duration_min: appt.duration_min, modality: appt.modality, type: appt.type, owner_id: (appt.owner as { id?: Id })?.id, vacancy_id: s.id ?? null })}
                      title={t('work.editIntake')} aria-label={t('work.editIntake')}
                      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
              </div>
            )})
          }
        </div>
        {apps.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{(page - 1) * PER + 1}–{Math.min(page * PER, apps.length)} {t('work.of')} {apps.length}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page >= pages ? 'default' : 'pointer', color: page >= pages ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
          </div>
        )}
      </div>
      </div>

      {modal === 'apply'  && <AddApplicationModal candidateId={c.id} onClose={() => setModal(null)} onCreated={reload} />}
      {modal === 'intake' && <PlanIntakeModal     candidateId={c.id} onClose={() => setModal(null)} onCreated={reload} />}
      {modal === 'match'  && <MatchPlacementModal candidateId={c.id} onClose={() => setModal(null)} onCreated={reload} />}
      {editAppt && <PlanIntakeModal candidateId={c.id} existing={editAppt} onClose={() => setEditAppt(null)} onCreated={reload} />}
    </div>
  )
}
