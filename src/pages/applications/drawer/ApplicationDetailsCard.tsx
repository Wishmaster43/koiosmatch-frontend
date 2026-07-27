import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import VacancyLinkField from './VacancyLinkField'
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

interface ApplicationDetailsCardProps {
  application: ApplicationDetail
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  onUpdateSource?: (id: Id | undefined, source: string) => void
}

/**
 * ApplicationDetailsCard — Danny 25-07 (c): the Bron/Klant/Locatie/Vacature
 * summary used to float without any card frame while every other block on the
 * tab (Motivatie, KoiosAdviceBlock) has one — moved here verbatim into the
 * shared SectionCard so it reads as a titled block like the rest. Same one
 * pencil → diskette/✕ edit mode as before (S7/S12/S13): the vacancy link and
 * Bron are editable in-place, Klant/Locatie stay read-only (Klant derives from
 * the vacancy, so it is never itself an edit target; phase/recruiter are edited
 * in the drawer header instead). Adds a Contactpersoon row (CONTACT-PERSON-1) —
 * a dash when the application carries no contact at all.
 */
export default function ApplicationDetailsCard({ application: a, onLinkVacancy, onUpdateSource }: ApplicationDetailsCardProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate } = useDateFormat()
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

  // Edit-mode toggle: pencil → diskette + ✕, shown as the card's action row (§3A pattern).
  const action = (onLinkVacancy || onUpdateSource) && (editing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}
        style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
      <button onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
        style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
    </div>
  ) : (
    <button onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
  ))

  return (
    <SectionCard title={t('drawer.detailsTitle')} action={action}>
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
            live on the Vacature tab — this summary deliberately stays light.
            Optional chaining: the drawer shows a LIGHT `Application` row cast as
            `ApplicationDetail` before the full GET /applications/{id} resolves —
            `vacancy` only exists once that fetch lands. */}
        <Field label={t('drawer.location')}>{a.vacancy?.location || '—'}</Field>
        {/* CONTACT-PERSON-1 (Danny 25-07 d): the vacancy/customer contact person —
            phone/email as a muted second line when present, dash when the
            application carries no contact at all. */}
        <Field label={t('drawer.contactPerson')}>
          {a.contact?.name ? (
            <>
              <div>{a.contact.name}</div>
              {(a.contact.phone || a.contact.email) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {[a.contact.phone, a.contact.email].filter(Boolean).join(' · ')}
                </div>
              )}
            </>
          ) : '—'}
        </Field>
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
        {/* APP-MATCH-SUMMARY-1: the linked Match (Hired -> placement) — renders
            NOTHING when the application has no Match at all, never a dash row
            for an absent relation (mirrors the honest-gate convention above). */}
        {a.match && (
          <div style={{ gridColumn: '1 / -1' }}>
            {/* The key is matchLabel, not match: 'drawer.match' does not exist and would
                have rendered the literal key on screen (seam between two parallel changes). */}
            <Field label={t('drawer.matchLabel')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <EntityLink page="matches" id={a.match.id} title={t('drawer.openMatch')}>
                  {a.match.referenceNumber || '—'}
                </EntityLink>
                <SoftChip label={a.match.statusLabel} color={a.match.statusColor} />
              </div>
              {a.match.placementStart && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {t('drawer.placementPeriod', {
                    start: formatDate(a.match.placementStart),
                    end: a.match.placementEnd ? formatDate(a.match.placementEnd) : t('drawer.placementOngoing'),
                  })}
                </div>
              )}
            </Field>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
