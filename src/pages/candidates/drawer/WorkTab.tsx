import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Plus, CalendarPlus } from 'lucide-react'
import MatchesTab from './MatchesTab'
import StatusPill from '@/components/ui/StatusPill'
import AddApplicationModal from './AddApplicationModal'
import PlanIntakeModal from './PlanIntakeModal'
import api from '@/lib/api'
import { sectionBlock } from './constants'
import type { Candidate } from '@/types/candidate'

// One application row as nested under the candidate (read defensively). The
// funnel stage (label + colour) used to live in the header chips — shown here now.
interface AppRow { logo_url?: string; vacancy?: { logo_url?: string; title?: string; url?: string; id?: string }; vacature?: string; title?: string; url?: string; stageLabel?: string; stageColor?: string }

// The vacancy link, when the API exposes a URL; otherwise falls back to plain text.
const vacancyUrlOf = (s: AppRow) => s.vacancy?.url ?? s.url ?? null

/** Work tab — matches + paginated applications, with the two candidate actions
 *  (§3B two-action model): couple to a vacancy, or plan an intake. */
export default function WorkTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  // Local copy of the applications so a create shows immediately (re-fetched from
  // the candidate detail after a POST — the BE may add a vacancy-less intake row).
  const [apps, setApps] = useState<AppRow[]>((c.applications ?? []) as unknown as AppRow[])
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<null | 'apply' | 'intake'>(null)
  // Reset the local list when the drawer switches to another candidate / fuller detail.
  useEffect(() => { setApps((c.applications ?? []) as unknown as AppRow[]); setPage(1) }, [c.id, c.applications])

  // Re-fetch the candidate after a create; the WorkTab shows the fresh applications.
  const reload = async () => {
    try {
      const r = await api.get(`/candidates/${c.id}`)
      const fresh = (r.data?.data ?? r.data) as { applications?: AppRow[] }
      setApps((fresh?.applications ?? []) as AppRow[]); setPage(1)
    } catch { /* keep the current list on a failed refresh */ }
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
              return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12, color: 'var(--text)' }}>
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
    </div>
  )
}
