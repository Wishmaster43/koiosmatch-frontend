/**
 * ApplicationDetailsCard — Danny 25-07 (c): the Bron/Klant/Locatie/Vacature
 * ("Source/Customer/Location/Vacancy") summary used to float without any card
 * frame while every other block on the tab (Motivatie/"Motivation",
 * KoiosAdviceBlock) has one — moved here verbatim into the
 * shared SectionCard so it reads as a titled block like the rest. Same one
 * pencil → diskette/✕ edit mode as before (S7/S12/S13): the vacancy link and
 * Bron are editable in-place, Klant/Locatie stay read-only (Klant derives from
 * the vacancy, so it is never itself an edit target; phase/recruiter are edited
 * in the drawer header instead). The Contactpersoon ("contact person") row
 * (CONTACT-PERSON-1) is
 * read-only by derivation, not by omission: it comes from the linked vacancy's
 * contact_id and is editable only on the vacancy — see the comment at that row.
 *
 * VAC-CASCADE-MIRROR-1 (Danny 05-08): Klantlocatie/Afdeling/Contactpersoon
 * ("Customer location/Department/Contact person") are
 * NOT an application-owned axis — the Application model has no
 * customer_location_id/customer_department_id/contact_id columns of its own
 * (verified in koiosmatch-api's Application model), so these three rows are
 * entirely derived from the LINKED VACANCY's own klant→locatie→afdeling→
 * contactpersoon ("customer→location→department→contact person") cascade.
 * ApplicationDetailResource's nested `vacancy`/`contact`
 * blocks only carry the vacancy's own work-site `city` + a name-only contact —
 * they never included customer_location/customer_department at all. Rather than
 * wait on a backend resource change, this block fetches the SAME full vacancy
 * detail the Vacature tab already reads (useApplicationVacancy — shared React
 * Query cache entry, §11: no duplicate fetch when both tabs are open across a
 * session) and sources all three rows from there, mirroring DetailsGeneralTab's
 * own EntityLink treatment byte-for-byte (customers page — locations/
 * departments/contacts have no page of their own).
 *
 * LABEL-LEFT-1 (Danny 05-08): converted from the label-above grid to the
 * candidate drawer's label-left row canon (fieldRowCanon) — this was the last
 * label-above holdout (§3A: the candidate drill-down leads, every other drawer
 * mirrors it). Content is unchanged, only row anatomy: every field below is now
 * one `Row`, stacked in the calm card instead of laid out in a 2-column grid.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { useDateFormat } from '@/lib/datetime'
import { useApplicationSources } from '@/lib/useApplicationSources'
import Button from '@/components/ui/Button'
// HUISSTIJL-1: shared typography atom — both muted secondary lines below are
// exact 11px/muted matches for the house Caption scale.
import { Caption } from '@/components/ui/typography'
import VacancyLinkField from './VacancyLinkField'
import { useVacancyLinkOptions } from '../hooks/useVacancyLinkOptions'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import { rememberReturnTab } from './constants'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// The card's inner block, overriding SectionCard's default layout with the
// candidate ProfileTab's calm-card shape (CANON-BOX, fieldRowCanon): rows
// stacked with gap 2 instead of a loose grid. Padding now matches SectionCard's
// own canon default ('6px 12px', §3A spacing residue) so it no longer needs
// overriding here.
const calmCardStyle = { display: 'flex', flexDirection: 'column' as const, gap: 2, overflow: 'hidden' as const }

// One label-LEFT field row (fieldRowCanon): fixed 120px muted label, value at
// 12px filling the rest — mirrors the candidate drawer's FieldRow byte-for-byte
// (Danny 05-08: this card was the last label-above holdout, §3A blueprint).
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={{ ...CANON_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
      {/* minWidth: 0 lets a long value truncate/wrap instead of widening the label column. */}
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

// S7: the Bron input shares the Details block's edit mode (same pencil/save/✕).
// Canon field style (G33/fieldMetrics) — was its own padding-7/font-12/radius-6 copy.
const inputStyle = fieldInputStyle

interface ApplicationDetailsCardProps {
  application: ApplicationDetail
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  onUpdateSource?: (id: Id | undefined, source: string) => void
}

// Vacancy-link + Bron (source) card for the application: shows the linked vacancy's cascade (customer/location/contact) and shares one pencil-edit mode for both fields.
export default function ApplicationDetailsCard({ application: a, onLinkVacancy, onUpdateSource }: ApplicationDetailsCardProps) {
  const { t } = useTranslation(['applications', 'common', 'vacancies'])
  const { formatDate } = useDateFormat()
  // In-place edit of the vacancy link + Bron (S7) — one shared pencil → picker/
  // input → diskette/✕ (§3A house pattern, mirrors KlantTab). Vacancy options
  // only load while editing.
  const [editing, setEditing] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const [source, setSource] = useState('')
  const { options: vacancyOptions, error: vacancyOptionsError } = useVacancyLinkOptions(editing)
  // S-SOURCE-1, GRADUATED 2026-08-14: source is a searchable/creatable picker backed
  // by the real /candidate-sources tenant lookup (see useApplicationSources' doc
  // comment for the full backend contract) instead of free text — never a hardcoded list.
  const { sources, allowFreeEntry } = useApplicationSources()
  // VAC-CASCADE-MIRROR-1: the linked vacancy's full detail (customer location/
  // department/contact) — null while loading or when no vacancy is linked; the
  // three rows below fall back to a dash rather than fabricate a value.
  const { vacancy: vac } = useApplicationVacancy(a.vacancyId)

  // Seed the edit form with the current vacancy/source before switching the card into edit mode.
  const startEdit = () => {
    setVacancyId(a.vacancyId != null ? String(a.vacancyId) : '')
    setSource(a.source ?? '')
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  // Commit the vacancy link and, only if it changed, the source; both calls are no-ops when their callback prop is absent.
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
      <Button variant="primary" iconOnly size="sm" onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
    </div>
  ) : (
    <Button variant="ghost" iconOnly size="sm" onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
  ))

  return (
    <SectionCard title={t('drawer.detailsTitle')} action={action} style={calmCardStyle}>
      {/* S7: Bron is editable in-place, sharing the Details block's pencil. */}
      <Row label={t('drawer.source')}>
        {editing ? (
          <CreatableSelect value={source} options={sources} onChange={setSource}
            allowCreate={allowFreeEntry} placeholder={t('drawer.source')} style={inputStyle}
            clearable clearLabel={t('drawer.source')} />
        ) : (
          a.source || '—'
        )}
      </Row>
      {/* S12/13: the customer is a real linkable entity (customer_id, the
          vacancy's client) — EntityLink gives in-app click + new-tab icon,
          mirrors the vacancy link below and KlantTab/vacancy DetailsTab's
          own customer link. Klant itself is never an edit target — it
          derives from the vacancy. */}
      <Row label={t('drawer.client')}>
        <EntityLink page="customers" id={a.customerId} title={t('drawer.openCustomer')}>{a.client || '—'}</EntityLink>
      </Row>
      {/* Klantlocatie (VAC-CASCADE-MIRROR-1) — the linked vacancy's own
          customer_location, sourced from the shared vacancy-detail fetch (see the
          file comment above), never the application's own fields (it has none).
          EntityLink opens the OWNING CUSTOMER (locations have no page of their
          own), same as DetailsGeneralTab's row for this exact field. Dash while
          the vacancy detail is loading, absent, or has no location picked. */}
      <Row label={t('vacancies:details.customerLocation')}>
        {vac?.customerLocationName ? <EntityLink page="customers" id={vac.clientId}>{vac.customerLocationName}</EntityLink> : '—'}
      </Row>
      {/* Afdeling — was missing entirely from this summary; the vacancy carries
          it (customer_department), so it is added here mirroring Klantlocatie. */}
      <Row label={t('vacancies:details.customerDepartment')}>
        {vac?.customerDepartmentName ? <EntityLink page="customers" id={vac.clientId}>{vac.customerDepartmentName}</EntityLink> : '—'}
      </Row>
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
      <Row label={t('vacancies:details.contactPerson')}>
        {vac?.contactName ? (
          <>
            <EntityLink page="customers" id={vac.clientId}>{vac.contactName}</EntityLink>
            {(a.contact?.phone || a.contact?.email) && (
              <Caption as="div">
                {[a.contact.phone, a.contact.email].filter(Boolean).join(' · ')}
              </Caption>
            )}
          </>
        ) : '—'}
      </Row>
      {editing ? (
        <Row label={t('drawer.vacancy')}>
          <VacancyLinkField value={vacancyId} options={vacancyOptions} onChange={setVacancyId} error={vacancyOptionsError} />
        </Row>
      ) : (
        <Row label={t('drawer.vacancy')}>
          {/* S12/S13: the vacancy is a real linkable entity (id available) —
              EntityLink gives in-app click + new-tab icon; the return-tab
              stash (S14/S22) makes browser BACK land back on this Sollicitatie
              ("Application") tab instead of resetting to the drawer's first tab. */}
          <span onClickCapture={() => { if (a.id != null) rememberReturnTab(a.id, 'application') }}>
            <EntityLink page="vacancies" id={a.vacancyId} title={t('drawer.openVacancy')}>
              {a.vacancyTitle || '—'}
            </EntityLink>
          </span>
        </Row>
      )}
      {/* APP-MATCH-SUMMARY-1: the linked Match (Hired -> match) — renders
          NOTHING when the application has no Match at all, never a dash row
          for an absent relation (mirrors the honest-gate convention above). */}
      {a.match && (
        // The key is matchLabel, not match: 'drawer.match' does not exist and would
        // have rendered the literal key on screen (seam between two parallel changes).
        <Row label={t('drawer.matchLabel')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <EntityLink page="matches" id={a.match.id} title={t('drawer.openMatch')}>
              {a.match.referenceNumber || '—'}
            </EntityLink>
            <SoftChip label={a.match.statusLabel} color={a.match.statusColor} />
          </div>
          {a.match.matchStart && (
            <Caption as="div" style={{ marginTop: 3 }}>
              {t('drawer.placementPeriod', {
                start: formatDate(a.match.matchStart),
                end: a.match.matchEnd ? formatDate(a.match.matchEnd) : t('drawer.placementOngoing'),
              })}
            </Caption>
          )}
        </Row>
      )}
    </SectionCard>
  )
}
