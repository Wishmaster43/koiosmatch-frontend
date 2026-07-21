import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Save, X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import DetailsTab from '@/pages/vacancies/drawer/DetailsTab'
import DescriptionTab from '@/pages/vacancies/drawer/DescriptionTab'
import { mapVacancyDetail } from '@/pages/vacancies/data/mapVacancy'
import { buildVacancyPatch } from '@/pages/vacancies/data/vacanciesShared'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import { rememberReturnTab } from './constants'
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
 * fetches the linked vacancy and renders the shared vacancy DetailsTab, so it
 * looks and BEHAVES identical to the real vacancy drawer instead of a bespoke
 * banner. The empty state gets a "Vacature koppelen" CTA and the linked state a
 * subtle "Ontkoppelen" affordance — both drive the same onLinkVacancy handler as
 * the Sollicitatie tab's Details block (VacancyLinkField, useVacancyLinkOptions).
 *
 * S20 fix (2026-07-17): this used to render <DetailsTab> WITHOUT an `onUpdate`,
 * intending it as "read-only" — but DetailsTab always shows its edit pencils
 * regardless (it has no read-only mode), so every field (incl. "Vereiste
 * vaardigheden") looked editable and silently did nothing on save (`onUpdate?.`
 * no-op'd). The BE write path already exists (VacancyWriter handles skills/etc.
 * for the real vacancy drawer), so the FE fix is to wire a real `onUpdate` here
 * too — reusing the exact PATCH shape (`buildVacancyPatch`) the vacancy page
 * uses — rather than fake a read-only mode DetailsTab doesn't support.
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

  // S20: make the reused DetailsTab actually persist — optimistic local merge,
  // then PATCH /vacancies/{id} with the same UI-patch → API-body mapping the
  // real vacancy drawer uses (buildVacancyPatch), so "Vereiste vaardigheden"
  // (and every other DetailsTab field) saves for real instead of no-op'ing.
  const updateVacancy = (id: Id | undefined, patch: Record<string, unknown>) => {
    if (id == null) return
    setVac(prev => (prev ? ({ ...prev, ...patch } as VacancyDetail) : prev))
    const body = buildVacancyPatch(patch)
    if (!Object.keys(body).length) return
    api.patch(`/vacancies/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

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

  // Full reuse: DetailsTab needs the vacancy lookups it renders labels from, and
  // (S20) now gets a real onUpdate so its edit pencils actually persist. A link
  // still jumps to the full vacancy record. Ontkoppelen lives ONLY in the drawer
  // footer (Danny 21-07: no duplicate top link) — that one collects the required
  // reason (S15); the top affordance both duplicated it and skipped that reason.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Vacancy NAME left + "Open vacature" right on ONE row — mirrors the Kandidaat
          tab's [name … Open kandidaat] header so both drill-downs read the same
          (Danny 21-07: "vacature moet zelfde soort worden … naam van de vacature links"). */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {a.vacancyTitle}
        </span>
        {/* S14/S22: stash the current subtab so browser BACK from the full vacancy
            page reopens THIS application's drawer on the Vacature tab again.
            Danny 21-07: this is an explicit "Open vacancy" AFFORDANCE (not the
            name+trailing-icon EntityLink pattern), so it is a real new-tab anchor
            rather than EntityLink's in-app button wrapped around the icon+label. */}
        <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'vacancy') }} style={{ flexShrink: 0 }}>
          {a.vacancyId != null ? (
            <a href={buildEntityDeepLink('vacancies', a.vacancyId)} target="_blank" rel="noopener noreferrer"
              title={t('drawer.openVacancy')} aria-label={t('drawer.openVacancy')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> {t('drawer.openVacancy')}
            </a>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <ExternalLink size={13} /> {t('drawer.openVacancy')}
            </span>
          )}
        </span>
      </div>
      <VacancyLookupsProvider>
        <DetailsTab vacancy={vac} onUpdate={updateVacancy} />
        {/* Danny 21-07: Beschrijving moved to its own drawer main-tab on the real
            vacancy — this drill-down has no main-tab bar, so it stays visible here
            by rendering right below Details (same shared onUpdate path). */}
        <div style={{ marginTop: 12 }}>
          <DescriptionTab vacancy={vac} onUpdate={updateVacancy} />
        </div>
      </VacancyLookupsProvider>
    </div>
  )
}
