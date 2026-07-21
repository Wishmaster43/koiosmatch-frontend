import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildApplicationAdviceInsights } from './applicationAiInsights'
import MatchScoreBlock from './MatchScoreBlock'
import type { Criterion } from './MatchScoreBlock'
import RejectionBlock from './RejectionBlock'
import type { RejectPayload } from './RejectionBlock'
import VacancyLinkField from './VacancyLinkField'
import CvBlock from './CvBlock'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import { rememberReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// A small label-above-value field.
function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const
// S7: the Bron input shares the Details block's edit mode (same pencil/save/✕).
const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' as const, outline: 'none' } as const

interface ApplicationTabProps {
  application: ApplicationDetail
  onReject?: (id: Id | undefined, payload: RejectPayload) => void
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
  // Re-link (or unlink, null) the vacancy this application is coupled to (BE:
  // PATCH /applications/{id} vacancy_id, nullable). Klant is derived from the
  // picked option so the caller can update it optimistically before the PATCH
  // response reconciles it. Undefined hides the pencil (read-only caller).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  // S7: PATCH the Bron field (PATCH /applications/{id} {source}) — shares the
  // Details block's edit mode/pencil with onLinkVacancy. Undefined hides the
  // pencil (read-only caller, mirrors onLinkVacancy).
  onUpdateSource?: (id: Id | undefined, source: string) => void
}

/**
 * ApplicationTab — the "Sollicitatie" tab: the linked candidate's CV (S31), the
 * AI task, the Details block (the vacancy link and Bron are editable in-place,
 * S7; Klant is a read-only EntityLink, S12/13 — it derives from the vacancy, so
 * it is never itself an edit target) and the overall match score. Phase +
 * recruiter are edited from the drawer header (meta pickers), so they no longer
 * live here. Candidate name/function are NOT editable here (Danny 21-07): both
 * are candidate-owned data (PATCH /candidates/{id}), not the application's own
 * fields — that edit lives on the candidate record itself (the Kandidaat tab's
 * "Open kandidaat" link, or the candidate's own drawer). The name still shows
 * read-only in the drawer header.
 * No repeated "Details" heading (§3A) — the pencil alone marks the editable block.
 * Locatie shows the vacancy's own work-site city when the backend sends one.
 * S19 (re-measured 2026-07-17): the vacancy NOW carries customer_location_id/
 * customer_department_id/contact_id (VAC-CASCADE-1, wave 6) — the older "no
 * afdeling exists yet" note above was stale. That fuller klant/locatie/afdeling/
 * contactpersoon picture already renders in the Vacature TAB (VacancyTab reuses
 * the real vacancy DetailsTab, which has those rows) — this Sollicitatie-tab
 * summary intentionally stays light (§3A: one shared surface, never fork the
 * same fields into two editors) and only adds the vacancy LINK here.
 */
export default function ApplicationTab({ application: a, onReject, onAdjustScore, onLinkVacancy, onUpdateSource }: ApplicationTabProps) {
  const { t } = useTranslation(['applications', 'common'])
  // In-place edit of the vacancy link + Bron (S7) — one shared pencil → picker/
  // input → diskette/✕ (§3A house pattern, mirrors KlantTab). Vacancy options
  // only load while editing.
  const [editing, setEditing] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const [source, setSource] = useState('')
  const vacancyOptions = useVacancyLinkOptions(editing)

  const startEdit = () => {
    setVacancyId(a.vacancyId != null ? String(a.vacancyId) : '')
    setSource(a.source ?? '')
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => {
    const picked = vacancyId ? vacancyOptions.find(v => String(v.value) === vacancyId) : undefined
    onLinkVacancy?.(a.id, vacancyId || null, { title: picked?.label, client: picked?.client })
    // S7: only PATCH the source when it actually changed (avoid a no-op write).
    if (source !== (a.source ?? '')) onUpdateSource?.(a.id, source)
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* S31: the linked candidate's CV(s) at a glance — reuses the candidate
          Documents tab's own preview affordance. */}
      <CvBlock candidateId={a.candidateId} />

      {/* AI task */}
      {a.task && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('drawer.task')}</div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--color-primary-bg)',
            borderRadius: 8, alignItems: 'flex-start' }}>
            <KoiosAiMark size={20} />
            <span style={{ fontSize: 13, color: 'var(--color-primary)', lineHeight: 1.5 }}>{a.task}</span>
          </div>
        </div>
      )}

      {/* Details — the vacancy link (S12/13) and Bron (S7) are editable in-place
          under one shared pencil; Klant stays a read-only EntityLink (it derives
          from the vacancy, so it is never itself an edit target) and Locatie
          stays read-only too (phase/recruiter are edited in the header instead).
          No repeated "Details" heading (S3) — the pencil (right-aligned, no
          heading to sit next to) is the only affordance needed. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12, minHeight: 26 }}>
          {/* In-place edit toggle: pencil → diskette + ✕, same spot (§0.3 pattern). */}
          {(onLinkVacancy || onUpdateSource) && (editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}
                style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
              <button onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
                style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
            </div>
          ) : (
            <button onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          {/* S7: Bron is editable in-place, sharing the Details block's pencil. */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.source')}</div>
            {editing ? (
              <input value={source} onChange={e => setSource(e.target.value)} style={inputStyle} placeholder={t('drawer.source')} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{a.source || '—'}</div>
            )}
          </div>
          {/* S12/13: the customer is a real linkable entity (customer_id, the
              vacancy's client) — EntityLink gives in-app click + new-tab icon,
              mirrors the vacancy link below and KlantTab/vacancy DetailsTab's
              own customer link. Klant itself is never an edit target — it
              derives from the vacancy. */}
          <Field label={t('drawer.client')}>
            <EntityLink page="customers" id={a.customerId} title={t('drawer.openCustomer')}>{a.client || '—'}</EntityLink>
          </Field>
          {/* Locatie (S6) — the vacancy's own work-site city when the backend sends
              one; dash otherwise. Klant/locatie/afdeling/contactpersoon in full
              live on the Vacature tab (see the file docblock, S19) — this summary
              deliberately stays light. */}
          {/* Optional chaining: the drawer shows a LIGHT `Application` row cast as
              `ApplicationDetail` before the full GET /applications/{id} resolves
              (ApplicationsPage.selectApplication) — `vacancy` only exists once that
              fetch lands, so this crashed on first render without the `?.` (measured
              live). Mirrors how the rest of this file already guards a.ai/a.rejection. */}
          <Field label={t('drawer.location')}>{a.vacancy?.location || '—'}</Field>
          <div style={{ gridColumn: '1 / -1' }}>
            {editing ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.vacancy')}</div>
                <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} />
              </div>
            ) : (
              <Field label={t('drawer.vacancy')}>
                {/* S12/S13: the vacancy is a real linkable entity (id available) —
                    EntityLink gives in-app click + new-tab icon; the return-tab
                    stash (S14/S22) makes browser BACK land back on this Sollicitatie
                    tab instead of resetting to the drawer's first tab. */}
                <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'application') }}>
                  <EntityLink page="vacancies" id={a.vacancyId} title={t('drawer.openVacancy')}>
                    {a.vacancyTitle || '—'}
                  </EntityLink>
                </span>
              </Field>
            )}
          </div>
        </div>
      </div>

      {/* Koios AI advisory — phase progress + vacancy-link completeness (§3A blueprint). */}
      <KoiosAdviceBlock namespace="applications" insights={buildApplicationAdviceInsights(a, t)} />

      {/* Match score — overall + configured criteria breakdown. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matchScore.title')}</div>
        <MatchScoreBlock score={a.score} criteria={a.matchCriteria as Criterion[]} summary={a.matchSummary}
          source={a.matchSource} aiScore={a.aiScore}
          onSave={onAdjustScore ? payload => onAdjustScore(a.id, payload) : undefined} />
      </div>

      {/* Rejection — hidden once the application is a placement (matched). */}
      {a.bucket !== 'matched' && <RejectionBlock application={a} onReject={onReject} />}
    </div>
  )
}
