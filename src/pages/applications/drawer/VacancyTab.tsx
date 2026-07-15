import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Unlink, Save, X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import EntityLink from '@/components/ui/EntityLink'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DetailsTab from '@/pages/vacancies/drawer/DetailsTab'
import { mapVacancyDetail } from '@/pages/vacancies/data/mapVacancy'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type LoadState = 'loading' | 'error' | 'empty' | 'ok'

const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', flexShrink: 0 } as const

interface VacancyTabProps {
  application: ApplicationDetail
  // Re-link (or unlink, null) the vacancy — the SAME handler as ApplicationTab's
  // Details block (§3A: one shared surface, never a per-tab fork).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
}

/**
 * VacancyTab — reuses the real vacancy detail inside the application drawer:
 * fetches the linked vacancy and renders the shared vacancy DetailsTab (read-only),
 * so it looks identical to the vacancy drawer instead of a bespoke banner. The
 * empty state gets a "Vacature koppelen" CTA and the linked state a subtle
 * "Ontkoppelen" affordance — both drive the same onLinkVacancy handler as the
 * Sollicitatie tab's Details block (VacancyLinkField, useVacancyLinkOptions).
 */
export default function VacancyTab({ application: a, onLinkVacancy }: VacancyTabProps) {
  const { t } = useTranslation(['applications', 'common'])
  const [vac, setVac] = useState<VacancyDetail | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  // Linking flow (empty state) — the CTA opens the shared picker directly (there
  // is nothing read-only to show yet, so no separate pencil step is needed).
  const [linking, setLinking] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const vacancyOptions = useVacancyLinkOptions(linking)

  // Fetch the full vacancy detail for the drawer; four UI states handled below.
  useEffect(() => {
    const id = a.vacancyId
    if (id == null) { setState('empty'); return }
    let alive = true
    setState('loading')
    api.get(`/vacancies/${id}`)
      .then(r => { if (!alive) return; setVac(mapVacancyDetail(unwrap(r))); setState('ok') })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [a.vacancyId])

  // Once a vacancy is actually linked, drop any in-flight linking draft.
  useEffect(() => { if (state === 'ok') setLinking(false) }, [state])

  // Save the picked vacancy (link) or clear it (unlink) via the shared handler;
  // the parent PATCHes /applications/{id} and reconciles from the response.
  const saveLink = () => {
    if (!vacancyId) return
    const picked = vacancyOptions.find(v => String(v.value) === vacancyId)
    onLinkVacancy?.(a.id, vacancyId, { title: picked?.label, client: picked?.client })
  }
  const unlink = () => onLinkVacancy?.(a.id, null)

  const muted: CSSProperties = { fontSize: 13, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }
  if (state === 'loading') return <div style={muted}>{t('vacancyDetail.loading')}</div>
  if (state === 'error') return <div style={muted}>{t('vacancyDetail.error')}</div>

  // Empty state — offer to link a vacancy right here (respects the guard-422
  // toast on save, surfaced by the parent handler).
  if (state === 'empty' || !vac) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancyDetail.empty')}</div>
        {onLinkVacancy && (linking ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', maxWidth: 340 }}>
            <div style={{ flex: 1 }}>
              <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} />
            </div>
            <button onClick={saveLink} disabled={!vacancyId} title={t('common:save')} aria-label={t('common:save')}
              style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: vacancyId ? 1 : 0.5 }}><Save size={13} /></button>
            <button onClick={() => setLinking(false)} title={t('common:cancel')} aria-label={t('common:cancel')}
              style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => { setVacancyId(''); setLinking(true) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500,
              borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            <Link2 size={13} /> {t('vacancyDetail.linkButton')}
          </button>
        ))}
      </div>
    )
  }

  // Read-only reuse: DetailsTab needs the vacancy lookups it renders labels from.
  // A link jumps to the full vacancy record (page + drawer) for edits; Ontkoppelen
  // sits next to it as a subtle affordance (guard-422 toast handled by the parent).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
        {onLinkVacancy && (
          <button onClick={unlink} title={t('vacancyDetail.unlink')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Unlink size={12} /> {t('vacancyDetail.unlink')}
          </button>
        )}
        <EntityLink page="vacancies" id={a.vacancyId} title={t('drawer.openVacancy')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <ExternalLink size={13} /> {t('drawer.openVacancy')}
          </span>
        </EntityLink>
      </div>
      <VacancyLookupsProvider>
        <DetailsTab vacancy={vac} />
      </VacancyLookupsProvider>
    </div>
  )
}
