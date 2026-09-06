/**
 * MatchClientRow — K-281 MATCH-CLIENT-EDIT: the match's client Field row, plus
 * (once unlocked and matches.update is granted) the reassign flow: a pencil
 * opens a searchable customer -> location -> department cascade (the SAME
 * shared useCustomerOptions/useCustomerCascade hooks the + Match modal uses,
 * §11 never a new fetch site — see useMatchClientEdit for the state machine),
 * and Save opens the shared ConfirmDialog before PATCHing.
 *
 * K-281 repair pass (manager, Opus reject — the first cut's confirm copy
 * stated the INVERSE of the backend). Measured in JobMatch (CMBE 03-09 +
 * manager update 03:20): owner_id, branch_id (the agency's OWN branch,
 * derived from the vacancy) and the linked vacancy are set on `creating`
 * ONLY — MatchController::update never touches them, so they do NOT follow
 * the new customer. Billing (cost_center/billing_emails/billing_source) DOES
 * get re-derived from the new customer (lands same day per CMBE). The one
 * other real consequence: approval_status can reset to pending
 * (JobMatch::saving, customer_id is a rate field). The confirm body
 * (drawer.clientChange.body) now says exactly this, and three Caption lines
 * (+ a fourth mismatch warning) show the CURRENT owner/vacancy/branch so the
 * user can verify them after the switch, per the acceptance criteria.
 *
 * A live HelloFlex contract locks the client (MatchClientGuard.php refuses
 * the write at the model level) — the pencil is hidden outright rather than
 * rendering a picker that would only 422 (§3 no fake affordances); the
 * Caption below the read-only value names why. NOTE (d): the pencil is also
 * hidden for a `customer_not_applicable` Contractvorm (MATCH-KLANTLOOS-1) —
 * that match legitimately has no customer/location/department to reassign.
 *
 * Split out of OverviewTab (§0.3 — that tab was approaching its 400-line
 * split trigger) so the tab itself stays a thin composer; permission is
 * checked LOCALLY via useAuth() here, mirroring the sibling Contract tab's
 * own MATCH-FIN-GATE-1 pattern (MatchContractSection.tsx), rather than
 * threading a new prop through MatchDrawer/MatchesPage (out of this ticket's
 * scope).
 *
 * K-281 repair pass 3 (Opus find): `match.client` is NOT this match's own
 * customer — it is the VACANCY's customer (backend client_name, resolved
 * from the vacancy's own client_id, ResolvesOwnersAndClients::
 * attachClientNames). This match's own customer is `match.customerName`
 * (the new `customer` key CMBE is adding to both list/detail resources,
 * absent → null on an older payload). The read-mode row shows the own name
 * when present, else falls back to the vacancy's customer with the honest
 * `drawer.fields.clientViaVacancy` label — the EntityLink target is always
 * `clientId` (this match's own customer id), since only the NAME source
 * differs. The confirm flow's optimistic patch therefore never touches
 * `client` (it cannot change from this PATCH) — only `customerName`.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Save as SaveIcon, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FieldNotice from '@/components/ui/FieldNotice'
import EntityLink from '@/components/ui/EntityLink'
import { Caption } from '@/components/ui/typography'
import { CANON_LABEL_WIDTH, dash } from '@/components/drawer/fieldRowCanon'
import { useAuth } from '@/context/AuthContext'
import { useLookupsOptional } from '@/context/LookupsContext'
import { useMatchClientEdit } from '../hooks/useMatchClientEdit'
import { Field } from './MatchFieldRow'
import type { MatchRow } from '@/types/match'

interface Props {
  match: MatchRow
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

// A present, non-dash string value (never "" or the literal em-dash placeholder).
const has = (v: string | null | undefined): v is string => !!v && v !== '—'

export default function MatchClientRow({ match, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'candidates', 'common'])
  const auth = useAuth()
  // NOTE (d): a `customer_not_applicable` Contractvorm (MATCH-KLANTLOOS-1) means
  // this match legitimately has no customer to reassign — tolerant read (null
  // outside a Provider, e.g. unit tests) so an absent flag never blocks editing.
  const lookups = useLookupsOptional()
  const contractFormNotApplicable = !!lookups?.typeMeta(match.contractForm?.value)?.customer_not_applicable
  const edit = useMatchClientEdit(match, onUpdate)

  // MATCH-CLIENT-EDIT (K-281): mirrors MatchClientGuard::isClientLocked exactly
  // (contract_status !== 'none' OR a set helloflex_contract_guid) — undefined/
  // null contractStatus reads as the unlocked default, never a false lock.
  const locked = (!!match.contractStatus && match.contractStatus !== 'none') || !!match.helloflexContractGuid
  // The picker only renders with a real persistence path (§3 no fake affordances):
  // permission, an unlocked non-archived match, and a customer-applicable
  // Contractvorm. Archived matches are read-only everywhere in this drawer
  // (MATCH-EDIT-1 precedent).
  const canEdit = !!auth?.hasPermission?.('matches.update') && !match.archived && !contractFormNotApplicable

  // K-281 repair pass 3 (Opus find, CMBE 06:25 contract): the row shows the
  // match's OWN customer (`customerName`, the NEW `customer` key) when the
  // backend has shipped it; a payload that predates the key falls back to
  // `client` (the VACANCY's customer) with the honest clientViaVacancy label,
  // so the user is never told a borrowed name is this match's own customer.
  // The EntityLink target is ALWAYS `clientId` (this match's own customer id)
  // regardless of which name is shown — the id side was never in question.
  const clientDisplayName = has(match.customerName) ? match.customerName : (has(match.client) ? match.client : '')
  const clientViaVacancy = !has(match.customerName) && has(match.client)

  // Read mode: the existing client link/dash, plus a pencil once unlocked and permitted.
  if (!edit.editing) {
    return (
      <>
        <Field label={clientViaVacancy ? t('drawer.fields.clientViaVacancy') : t('drawer.fields.client')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {has(clientDisplayName)
              ? <EntityLink page="customers" id={match.clientId} title={t('drawer.openClient')}>{clientDisplayName}</EntityLink>
              : dash}
            {!locked && canEdit && (
              <Button variant="ghost" iconOnly size="sm" onClick={edit.startEdit}
                aria-label={t('drawer.editClient')} title={t('drawer.editClient')}>
                <Pencil size={13} />
              </Button>
            )}
          </div>
        </Field>
        {/* Indented to the value column (CANON_LABEL_WIDTH + Field's own 12px
            gap), never a full-width banner on a single field row. */}
        {locked && (
          <Caption style={{ paddingLeft: CANON_LABEL_WIDTH + 12, marginTop: -2 }}>
            {t('drawer.clientLocked')}
          </Caption>
        )}
      </>
    )
  }

  // K-281 repair: what stays UNCHANGED by this PATCH, shown as Caption lines so
  // the user can verify them after the switch (CMBE's acceptance criteria) —
  // each line only renders when the match row actually carries that data.
  const vacancyLine = [match.vacancy, match.client].filter(has).join(' · ')
  // K-281 repair pass 3 (Opus find): match.client IS the vacancy's customer,
  // straight from the server (client_name, resolved from the vacancy's own
  // client_id — ResolvesOwnersAndClients::attachClientNames) — it was never
  // "this match's current customer" (that concept is match.customerName /
  // edit.customerId). The mismatch line compares that server-truth vacancy
  // customer against the NEWLY PICKED customer, since this PATCH reassigns
  // the match's own customer_id without touching the vacancy's link at all.
  const vacancyMismatch = has(match.vacancy) && has(match.client) && has(edit.customerName) && edit.customerName !== match.client

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <Button variant="primary" size="sm" iconOnly onClick={edit.requestSave}
          disabled={!edit.customerId || edit.saving}
          aria-label={t('common:save')} title={t('common:save')}>
          <SaveIcon size={13} />
        </Button>
        <Button variant="secondary" size="sm" iconOnly onClick={edit.cancelEdit} disabled={edit.saving}
          aria-label={t('common:cancel')} title={t('common:cancel')}>
          <X size={13} />
        </Button>
      </div>
      <Field label={t('drawer.fields.client')}>
        <CreatableSelect value={edit.customerId || null} onChange={edit.handleCustomerChange} allowCreate={false}
          placeholder={t('candidates:placement.pickCustomer')}
          options={edit.customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />
      </Field>
      <Field label={t('drawer.fields.customerLocation')}>
        <CreatableSelect value={edit.locationId || null} onChange={edit.handleLocationChange} allowCreate={false}
          clearable clearLabel={t('drawer.fields.customerLocation')}
          placeholder={edit.customerId ? t('candidates:placement.pickLocation') : t('candidates:placement.pickCustomerFirst')}
          options={edit.locationOptions} />
      </Field>
      <Field label={t('drawer.fields.customerDepartment')}>
        <CreatableSelect value={edit.departmentId || null} onChange={edit.setDepartmentId} allowCreate={false}
          clearable clearLabel={t('drawer.fields.customerDepartment')}
          placeholder={t('candidates:placement.optional')}
          options={edit.departmentOptions} />
      </Field>
      <FieldNotice text={edit.error} severity="error" />

      {/* K-281 repair: the confirm body now states the TRUTH (owner/own branch/
          vacancy stay as they are, billing is re-derived, approval may reset) —
          the Caption lines below it show the CURRENT values to verify. */}
      <ConfirmDialog open={edit.confirmOpen} onCancel={edit.cancelConfirm} onConfirm={edit.confirmSave}
        title={t('drawer.clientChange.title')}
        message={t('drawer.clientChange.body', {
          customer: edit.customerName,
          location: edit.locationName || t('drawer.clientChange.none'),
          department: edit.departmentName || t('drawer.clientChange.none'),
        })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {has(match.owner) && <Caption as="div">{t('drawer.clientChange.currentOwner', { owner: match.owner })}</Caption>}
          {vacancyLine && <Caption as="div">{t('drawer.clientChange.currentVacancy', { vacancy: vacancyLine })}</Caption>}
          {vacancyMismatch && (
            <Caption as="div">{t('drawer.clientChange.vacancyMismatch', { title: match.vacancy, vacancyCustomer: match.client })}</Caption>
          )}
          {has(match.branchName) && <Caption as="div">{t('drawer.clientChange.currentBranch', { branch: match.branchName })}</Caption>}
        </div>
      </ConfirmDialog>
    </div>
  )
}
