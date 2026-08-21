import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Link2, Save, X } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { buildEntityDeepLink } from '@/components/ui/EntityLink'
import { VacancyLookupsProvider } from '@/context/VacancyLookupsContext'
import { DetailsTab } from '@/pages/vacancies/shared'
import { DescriptionTab } from '@/pages/vacancies/shared'
import { buildVacancyPatch } from '@/pages/vacancies/shared'
import { SectionTitle } from '@/components/ui/typography'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import { rememberReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

type LoadState = 'loading' | 'error' | 'empty' | 'ok'

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
  const queryClient = useQueryClient()
  // Shared vacancy-detail fetch (adopted from useApplicationVacancy — §11: land the
  // new helper WITH adoption at this exact copy site instead of leaving VacancyTab's
  // own useEffect/useState/api.get running alongside it). CompetitionBlock reads the
  // same cache entry, so the two tabs never issue duplicate requests.
  const { vacancy: vac, loading, error } = useApplicationVacancy(a.vacancyId)
  const state: LoadState = a.vacancyId == null ? 'empty' : loading ? 'loading' : error ? 'error' : vac ? 'ok' : 'empty'
  // Linking flow (empty state) — the CTA opens the shared picker directly (there
  // is nothing read-only to show yet, so no separate pencil step is needed).
  const [linking, setLinking] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const vacancyOptions = useVacancyLinkOptions(linking)

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
    // OPTIMISTIC-REVERT-1 (audit 2026-07-27, same bug class as useApplicationDrawerActions):
    // snapshot ONLY the fields this patch touches, read off the cache BEFORE the optimistic
    // write — never the whole cached vacancy, so a parallel edit to another field (e.g. from
    // CompetitionBlock reading the same entry) is not clobbered by the revert.
    const queryKey = ['vacancies', id, 'detail']
    const cached = queryClient.getQueryData<VacancyDetail>(queryKey) as Record<string, unknown> | undefined
    const beforeFields = cached ? Object.fromEntries(Object.keys(patch).map(k => [k, cached[k]])) : null
    // Optimistic merge straight into the shared React Query cache entry (the same
    // key useApplicationVacancy reads), so both this tab and CompetitionBlock see
    // the edit immediately without a duplicate local copy of the vacancy.
    queryClient.setQueryData(queryKey, (prev: VacancyDetail | undefined) =>
      prev ? ({ ...prev, ...patch } as VacancyDetail) : prev)
    const body = buildVacancyPatch(patch)
    if (!Object.keys(body).length) return
    api.patch(`/vacancies/${id}`, body).catch(err => {
      // Revert only the touched fields onto the CURRENT cache value — a rejected PATCH
      // must not leave "Vereiste vaardigheden" (or any other field) showing a value the
      // server never accepted.
      if (beforeFields) {
        queryClient.setQueryData(queryKey, (prev: VacancyDetail | undefined) =>
          prev ? ({ ...prev, ...beforeFields } as VacancyDetail) : prev)
      }
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }

  // Canon (05-08): 12px muted body text, matching the sibling tabs' loading/error copy.
  const muted: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }
  if (state === 'loading') return <div style={muted}>{t('vacancyDetail.loading')}</div>
  if (state === 'error') return <div style={muted}>{t('vacancyDetail.error')}</div>

  // Empty state — offer to link a vacancy right here (respects the guard-422
  // toast on save, surfaced by the parent handler).
  if (state === 'empty' || !vac) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('vacancyDetail.empty')}</div>
        {onLinkVacancy && (linking ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', maxWidth: 340 }}>
            <div style={{ flex: 1 }}>
              <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} />
            </div>
            <Button variant="primary" iconOnly size="sm" onClick={saveLink} disabled={!vacancyId} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
            <Button variant="secondary" iconOnly size="sm" onClick={() => setLinking(false)} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
          </div>
        ) : (
          // Primary, not secondary (Danny 20-08, pasted this button: "Huisstijl") —
          // coupling the vacancy is THE action of this empty state.
          <Button variant="primary" size="sm" onClick={() => { setVacancyId(''); setLinking(true) }}>
            <Link2 size={13} /> {t('vacancyDetail.linkButton')}
          </Button>
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
        <SectionTitle as="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {a.vacancyTitle}
        </SectionTitle>
        {/* S14/S22: stash the current subtab so browser BACK from the full vacancy
            page reopens THIS application's drawer on the Vacature tab again.
            Danny 21-07: this is an explicit "Open vacancy" AFFORDANCE (not the
            name+trailing-icon EntityLink pattern), so it is a real new-tab anchor
            rather than EntityLink's in-app button wrapped around the icon+label. */}
        <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'vacancy') }} style={{ flexShrink: 0 }}>
          {/* A TRUE text link (accent ink, no chrome) — V7 covers button-lookalikes
              only. Block form: the style attribute sits inside the opening tag. */}
          {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
          {a.vacancyId != null ? (
            <a href={buildEntityDeepLink('vacancies', a.vacancyId)} target="_blank" rel="noopener noreferrer"
              title={t('drawer.openVacancy')} aria-label={t('drawer.openVacancy')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-primary-text)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> {t('drawer.openVacancy')}
            </a>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <ExternalLink size={13} /> {t('drawer.openVacancy')}
            </span>
          )}
          {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
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
