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
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
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
 * in the drawer header instead). The Contactpersoon row (CONTACT-PERSON-1) is
 * read-only by derivation, not by omission: it comes from the linked vacancy's
 * contact_id and is editable only on the vacancy — see the comment at that row.
 *
 * VAC-CASCADE-MIRROR-1 (Danny 05-08): Klantlocatie/Afdeling/Contactpersoon are
 * NOT an application-owned axis — the Application model has no
 * customer_location_id/customer_department_id/contact_id columns of its own
 * (verified in koiosmatch-api's Application model), so these three rows are
 * entirely derived from the LINKED VACANCY's own klant→locatie→afdeling→
 * contactpersoon cascade. ApplicationDetailResource's nested `vacancy`/`contact`
 * blocks only carry the vacancy's own work-site `city` + a name-only contact —
 * they never included customer_location/customer_department at all. Rather than
 * wait on a backend resource change, this block fetches the SAME full vacancy
 * detail the Vacature tab already reads (useApplicationVacancy — shared React
 * Query cache entry, §11: no duplicate fetch when both tabs are open across a
 * session) and sources all three rows from there, mirroring DetailsGeneralTab's
 * own EntityLink treatment byte-for-byte (customers page — locations/
 * departments/contacts have no page of their own).
 */
export default function ApplicationDetailsCard({ application: a, onLinkVacancy, onUpdateSource }: ApplicationDetailsCardProps) {
  const { t } = useTranslation(['applications', 'common', 'vacancies'])
  const { formatDate } = useDateFormat()
  // In-place edit of the vacancy link + Bron (S7) — one shared pencil → picker/
  // input → diskette/✕ (§3A house pattern, mirrors KlantTab). Vacancy options
  // only load while editing.
  const [editing, setEditing] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const [source, setSource] = useState('')
  const vacancyOptions = useVacancyLinkOptions(editing)
  // VAC-CASCADE-MIRROR-1: the linked vacancy's full detail (customer location/
  // department/contact) — null while loading or when no vacancy is linked; the
  // three rows below fall back to a dash rather than fabricate a value.
  const { vacancy: vac } = useApplicationVacancy(a.vacancyId)

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
        {/* Klantlocatie (VAC-CASCADE-MIRROR-1) — the linked vacancy's own
            customer_location, sourced from the shared vacancy-detail fetch (see the
            file comment above), never the application's own fields (it has none).
            EntityLink opens the OWNING CUSTOMER (locations have no page of their
            own), same as DetailsGeneralTab's row for this exact field. Dash while
            the vacancy detail is loading, absent, or has no location picked. */}
        <Field label={t('vacancies:details.customerLocation')}>
          {vac?.customerLocationName ? <EntityLink page="customers" id={vac.clientId}>{vac.customerLocationName}</EntityLink> : '—'}
        </Field>
        {/* Afdeling — was missing entirely from this summary; the vacancy carries
            it (customer_department), so it is added here mirroring Klantlocatie. */}
        <Field label={t('vacancies:details.customerDepartment')}>
          {vac?.customerDepartmentName ? <EntityLink page="customers" id={vac.clientId}>{vac.customerDepartmentName}</EntityLink> : '—'}
        </Field>
        {/* Contactpersoon (CONTACT-PERSON-1 + VAC-CASCADE-MIRROR-1) — the name +
            EntityLink come from the same shared vacancy-detail fetch as the two
            rows above (guaranteed to match the Vacature tab); phone/email ride
            along from ApplicationDetailResource's own `contact` block as a
            best-effort second line (that contract carries them, the vacancy
            detail's contact does not) — shown only when present, never fabricated.
            Deliberately outside the pencil's edit mode: the field is derived from
            the vacancy's contact_id, and UpdateApplicationRequest has no contact
            field, so a picker here would PATCH nothing — changing it happens on
            the vacancy (Vacature tab → Details → Contactpersoon), which is also
            where the vacancies.update permission is checked. */}
        {/* Full-width (§ layout): a 5th field would otherwise leave a dangling
            empty half-row in the 2-column grid — spanning it reads cleanly and
            matches the Vacature/Match rows below, which are already full-width. */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label={t('vacancies:details.contactPerson')}>
            {vac?.contactName ? (
              <>
                <EntityLink page="customers" id={vac.clientId}>{vac.contactName}</EntityLink>
                {(a.contact?.phone || a.contact?.email) && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {[a.contact.phone, a.contact.email].filter(Boolean).join(' · ')}
                  </div>
                )}
              </>
            ) : '—'}
          </Field>
        </div>
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
        {/* APP-MATCH-SUMMARY-1: the linked Match (Hired -> match) — renders
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
              {a.match.matchStart && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {t('drawer.placementPeriod', {
                    start: formatDate(a.match.matchStart),
                    end: a.match.matchEnd ? formatDate(a.match.matchEnd) : t('drawer.placementOngoing'),
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
