/**
 * RelationsSection — the "Relaties" block of the match form: optional
 * candidate picker, customer→location→department→contact cascade (typeable
 * searchable pickers, allowCreate=false — never a free-text create for a real
 * relational id), inline contact creation, function/owner, optional vacancy,
 * and the branch-mismatch banner. Split out of MatchModal.tsx (audit
 * R1 item 1, MUST-SPLIT) — pure presentational, all state/handlers via props
 * from useMatchForm.
 *
 * Danny 24-07: Branch AND Recruiter are now searchable CreatableSelects
 * (both were a plain SelectMenu); the contact picker shows "Naam —
 * Functietitel" ("Name — Job title") so same-named contacts stay distinguishable; the inline
 * new-contact form gained a searchable Functie (job title) picker + phone/mobile fields
 * and a duplicate-contact preflight message; the "+ nieuw" affordance is now
 * the shared `DrawerAddButton` (the house soft-tint chip) instead of a bare
 * text link. No plain SelectMenu is left in this section.
 *
 * LABEL-LEFT (Danny 13-08): every field is now its own full-width label-left
 * row (FormField/styles' P33 canon) instead of a label-above two/three-up
 * grid — customer/location and function/owner pair up via `pairRow` (each
 * cell still its own label-left row), the rest stack one per row.
 */
import { useId, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { FormField as F } from './FormField'
import ContractLinesSection from './ContractLinesSection'
import { errMsg, labelLeftRow, rowLabel, rowField, pairRow, pickerMenuWidth, input } from './styles'
import type { CascadeOption, CascadeLocation, CascadeDepartment, CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { CustomerOption } from '@/pages/vacancies/shared'
import type { VacancyOption } from '@/pages/candidates/hooks/useVacancyOptions'
import type { LocationOption } from '@/lib/useLocations'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'
import type { MatchContractLine } from '@/types/match'
import { contactOptionLabel } from '@/lib/contactLabel'
import { tintBg, tintBorder } from '@/lib/tint'
import Button from '@/components/ui/Button'

interface UserLike { id?: Id; name?: string }
interface NewContact { first_name: string; last_name: string; email: string; phone: string; mobile: string; function: string }

// A relational option list → { value, label } pairs for the shared pickers.
const opt = (arr: Array<{ id?: Id; name?: string }>) => arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

// Contact-person options via the shared "Name — Function" label builder (Danny
// 24-07 live screenshot: same-named contacts were indistinguishable). Was a
// local copy here; now the one shared implementation in lib/contactLabel.
const contactOpt = (arr: CascadeOption[]) => arr.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))

export default function RelationsSection({
  t, errors, editing,
  candidateTypes, contractForm, setContractForm, hasContractLines, contractLines, setContractLines, customerNotApplicable,
  fixedCandidateId, pickedCandidateId, setPickedCandidateId, candidateOptions,
  customerId, setCustomerId, customerOptions,
  locationId, setLocationId, locations,
  departmentId, setDepartmentId, departments,
  contactId, setContactId, contacts,
  creatingContact, setCreatingContact, nc, setNc, saveContact,
  duplicateContact, setDuplicateContact,
  contactFunctions, contactFunctionsAllowFreeEntry,
  func, setFunc, functions,
  ownerId, setOwnerId, users,
  branchId, setBranchId, setBranchDirty, branchLocations,
  vacancyId, setVacancyId, vacancyOptions,
  branchMismatch, candBranch, detail, mismatchChoice, setMismatchChoice,
}: {
  t: TFunction; errors: Record<string, boolean>
  // Point 2 (Danny live P1): identity (candidate/vacancy) isn't accepted by the
  // backend's PATCH — the vacancy field renders read-only while editing an
  // existing match instead of a pick that would silently never persist (§3).
  editing?: boolean
  // MATCH-SOORT-1: Contractvorm (§1 of the changelog) — the FIRST field in this
  // card, feeding the conditional CONTRACTREGELS editor below it.
  candidateTypes: LookupItem[]
  contractForm: string; setContractForm: (v: string) => void
  hasContractLines: boolean
  // MATCH-KLANTLOOS-1: the picked Contractvorm's own flag — hides customer/location/
  // department/contact entirely and makes Branch required instead.
  customerNotApplicable: boolean
  contractLines: MatchContractLine[]; setContractLines: (v: MatchContractLine[]) => void
  fixedCandidateId?: Id; pickedCandidateId: string; setPickedCandidateId: (v: string) => void
  candidateOptions: Array<{ id?: Id; name?: string }>
  customerId: string; setCustomerId: (v: string) => void; customerOptions: CustomerOption[]
  locationId: string; setLocationId: (v: string) => void; locations: CascadeLocation[]
  departmentId: string; setDepartmentId: (v: string) => void; departments: CascadeDepartment[]
  contactId: string; setContactId: (v: string) => void; contacts: CascadeOption[]
  creatingContact: boolean; setCreatingContact: (v: boolean) => void
  nc: NewContact; setNc: Dispatch<SetStateAction<NewContact>>; saveContact: () => void
  // Duplicate-contact preflight result (Danny 24-07) — set by saveContact() when
  // the entered email/phone/mobile already matches a contact on this customer.
  duplicateContact: CascadeOption | null; setDuplicateContact: (v: CascadeOption | null) => void
  // useContactFunctions() returns { value, label } rows (LOOKUP-I18N-1): value is
  // the raw name written to the new contact's `function`, label is translated.
  contactFunctions: Array<{ value: string; label: string }>; contactFunctionsAllowFreeEntry: boolean
  func: string; setFunc: (v: string) => void; functions: string[]
  ownerId: string; setOwnerId: (v: string) => void; users: UserLike[]
  // Branch picker (7.4) — the TENANT's own establishments, distinct from the
  // customer-cascade `locations` above (a customer's nested address).
  branchId: string; setBranchId: (v: string) => void; setBranchDirty: (v: boolean) => void; branchLocations: LocationOption[]
  vacancyId: string; setVacancyId: (v: string) => void; vacancyOptions: VacancyOption[]
  branchMismatch: boolean; candBranch: { id: Id | null; name: string } | null; detail: CustomerCascadeDetail | null
  mismatchChoice: 'match' | 'candidate'; setMismatchChoice: (v: 'match' | 'candidate') => void
}) {
  // Manual label id (Contactpersoon isn't wrapped by the shared F helper — its
  // label row also carries the "+ nieuw" button) so the picker below can still
  // be named via aria-labelledby, same recipe as every F-wrapped field here.
  const contactLabelId = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* MATCH-SOORT-1 (§1 of the changelog): Contractvorm is the FIRST choice in
          this card — pick-only (allowCreate=false, a real lookup value), clearable
          (an optional field per CLAUDE.md §3A's VAC-CLEAR-1 rule). Picking a
          flagged value reveals CONTRACTREGELS right under it. */}
      <F label={t('placement.contractForm')} error={errors.contractForm}>
        {(labelId: string) => (
          <CreatableSelect value={contractForm || null} onChange={setContractForm} allowCreate={false}
            placeholder={t('placement.pickContractForm')} menuWidth={pickerMenuWidth} clearable clearLabel={t('placement.contractForm')}
            aria-labelledby={labelId}
            options={candidateTypes.map(c => ({ value: c.value, label: c.label }))} />
        )}
      </F>
      {hasContractLines && (
        <ContractLinesSection t={t} lines={contractLines} setLines={setContractLines} functions={functions} />
      )}
      {/* Candidate picker — only when the modal wasn't opened from a candidate.
          Searchable (job 18): the candidate list can run into the hundreds. */}
      {!fixedCandidateId && (
        <F label={t('placement.candidate')} error={errors.pickedCandidateId}>
          {(labelId: string) => (
            <CreatableSelect value={pickedCandidateId || null} onChange={setPickedCandidateId} allowCreate={false}
              placeholder={t('placement.pickCandidate')} menuWidth={pickerMenuWidth}
              aria-labelledby={labelId}
              options={candidateOptions.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
          )}
        </F>
      )}
      {/* MATCH-KLANTLOOS-1: a klant-loos Contractvorm hides the whole customer
          cascade — klant/locatie/afdeling/contactpersoon simply do not apply,
          and the submit body never carries any of the four (§3 no fake affordances:
          a picker that can never persist for this form must not render at all). */}
      {!customerNotApplicable && (
        <>
          <div style={pairRow}>
            {/* Klant/locatie — typeable searchable pickers (job 17/18), never free-text
                create (allowCreate={false}: a customer/location is a real relational id). */}
            <F label={t('placement.customer')} error={errors.customerId}>
              {(labelId: string) => (
                <CreatableSelect value={customerId || null} onChange={setCustomerId} allowCreate={false}
                  placeholder={t('placement.pickCustomer')} menuWidth={pickerMenuWidth}
                  aria-labelledby={labelId}
                  options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />
              )}
            </F>
            <F label={t('placement.location')} error={errors.locationId}>
              {(labelId: string) => (
                <CreatableSelect value={locationId || null} onChange={v => { setLocationId(v); setDepartmentId('') }}
                  allowCreate={false} menuWidth={pickerMenuWidth}
                  placeholder={customerId ? t('placement.pickLocation') : t('placement.pickCustomerFirst')}
                  aria-labelledby={labelId}
                  options={opt(locations)} />
              )}
            </F>
          </div>
          <div style={pairRow}>
            {/* Afdeling/contactpersoon — same searchable pattern. allowCreate={false}
                was missing here (live-check finding, kandidaten-ronde-2 punt C.2.1):
                a department is a real relational id like customer/location/contact,
                never a free-text create — the file header already claimed this. */}
            <F label={t('placement.department')} error={errors.departmentId}>
              {(labelId: string) => (
                <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
                  placeholder={t('placement.optional')} menuWidth={pickerMenuWidth} options={opt(departments)}
                  aria-labelledby={labelId} />
              )}
            </F>
            <div style={labelLeftRow}>
              <div style={{ ...rowLabel, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span id={contactLabelId}>{t('placement.contact')}</span>
                {/* House soft-tint chip (Danny 24-07 screenshot feedback) — the shared
                    DrawerAddButton, not a bare text link. Wraps under the label in the
                    narrower label-left column. */}
                {customerId && !creatingContact && (
                  <DrawerAddButton onClick={() => setCreatingContact(true)} label={t('placement.newContact')} />
                )}
              </div>
              <div style={rowField}>
              {creatingContact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input value={nc.first_name} onChange={e => setNc(p => ({ ...p, first_name: e.target.value }))} placeholder={t('placement.firstName')} style={{ ...input, height: 30 }} />
                    <input value={nc.last_name} onChange={e => setNc(p => ({ ...p, last_name: e.target.value }))} placeholder={t('placement.lastName')} style={{ ...input, height: 30 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input value={nc.email} onChange={e => setNc(p => ({ ...p, email: e.target.value }))} placeholder={t('placement.email')} style={{ ...input, height: 30 }} />
                    {/* Functie — searchable/creatable per the tenant's contact-function
                        lookup (Danny 24-07 addendum), mirrors AddContactPersonModal. */}
                    <CreatableSelect value={nc.function || null} onChange={v => setNc(p => ({ ...p, function: v }))}
                      allowCreate={contactFunctionsAllowFreeEntry} placeholder={t('placement.contactFunction')}
                      options={contactFunctions} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input type="tel" value={nc.phone} onChange={e => setNc(p => ({ ...p, phone: e.target.value }))} placeholder={t('placement.phone')} style={{ ...input, height: 30 }} />
                    <input type="tel" value={nc.mobile} onChange={e => setNc(p => ({ ...p, mobile: e.target.value }))} placeholder={t('placement.mobile')} style={{ ...input, height: 30 }} />
                  </div>
                  {/* Duplicate-contact preflight (Danny 24-07): blocks the save, names the
                      existing match — the backend enforces no uniqueness on these fields. */}
                  {duplicateContact && (
                    <div role="alert" style={{ fontSize: 11.5, color: 'var(--color-warning)',
                      background: tintBg('var(--color-warning)'),
                      border: tintBorder('var(--color-warning)'), borderRadius: 6, padding: '6px 8px' }}>
                      {t('placement.duplicateContact', { name: duplicateContact.name ?? '—' })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" onClick={() => { setCreatingContact(false); setDuplicateContact(null); setNc({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' }) }}>{t('common:cancel')}</Button>
                    <Button variant="primary" size="sm" onClick={saveContact} disabled={!nc.first_name.trim() || !nc.last_name.trim()}>{t('common:save')}</Button>
                  </div>
                </div>
              ) : (
                <CreatableSelect value={contactId || null} onChange={setContactId} allowCreate={false} menuWidth={pickerMenuWidth}
                  placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={contactOpt(contacts)}
                  aria-labelledby={contactLabelId} />
              )}
              {errors.contactId && <div style={errMsg}>{t('common:required')}</div>}
              </div>
            </div>
          </div>
        </>
      )}
      {/* Functie — searchable (tenant lookup, can run to dozens of job titles);
          Recruiter is now searchable too (Danny 24-07 addendum, same treatment as
          Contractsoort/Vestiging/CAO) — stays optional exactly like before: no
          pick = empty value, same placeholder, no dedicated clear affordance
          (neither widget offers one; only the STARTING empty state carried the
          "none" meaning, unchanged here). Functie/Eigenaar pair up (short fields,
          P33); Vestiging (7.4) gets its own full-width row below. */}
      <div style={pairRow}>
        <F label={t('placement.function')} error={errors.func}>
          {(labelId: string) => (
            <CreatableSelect value={func || null} onChange={setFunc} allowCreate={false}
              placeholder={t('placement.pickFunction')} menuWidth={pickerMenuWidth}
              aria-labelledby={labelId}
              options={functions.map(f => ({ value: f, label: f }))} />
          )}
        </F>
        <F label={t('placement.owner')} error={errors.ownerId}>
          {(labelId: string) => (
            <CreatableSelect value={ownerId || null} onChange={setOwnerId} allowCreate={false}
              placeholder={t('placement.optional')} menuWidth={pickerMenuWidth}
              aria-labelledby={labelId}
              options={users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))} />
          )}
        </F>
      </div>
      {/* Branch (7.4) — proposes from the customer's own branch, then the
          recruiter's, then the tenant default (useBranchDefault); editing it by
          hand freezes the proposal (setBranchDirty), same pattern as cost centre.
          MATCH-KLANTLOOS-1: REQUIRED (no clear affordance) on a customer-less
          Contractvorm — the server rejects the match without a branch_id then. */}
      <F label={t('placement.branch')} error={errors.branchId}>
        {(labelId: string) => (
          <CreatableSelect value={branchId || null} onChange={v => { setBranchDirty(true); setBranchId(v) }}
            allowCreate={false} menuWidth={pickerMenuWidth}
            placeholder={customerNotApplicable ? t('placement.pickBranch') : t('placement.optional')}
            aria-labelledby={labelId}
            options={branchLocations.map(l => ({ value: String(l.value), label: l.label }))} />
        )}
      </F>
      {/* Vacature — searchable, mirrors PlanIntakeModal's vacancy picker. Read-only
          while editing: identity fields (candidate/vacancy) aren't accepted by the
          backend's PATCH /matches/{id} (UpdateMatchRequest), so a pick here would
          silently never persist — render the current value as plain text instead
          of a fake-interactive control (§3, no fake affordances). */}
      {editing ? (
        <F label={t('placement.vacancyOptional')}>
          <div style={{ ...input, display: 'flex', alignItems: 'center', background: 'var(--hover-bg)', color: vacancyId ? 'var(--text)' : 'var(--text-muted)' }}>
            {vacancyOptions.find(v => String(v.value) === vacancyId)?.label ?? t('placement.noVacancy')}
          </div>
        </F>
      ) : (
        <F label={t('placement.vacancyOptional')} error={errors.vacancyId}>
          {/* CLEAR (point 1.8.4, Danny's ten-point round: "een misklik moet
              herstelbaar zijn") — the shared CreatableSelect's own opt-in `clearable`
              X (VAC-CLEAR-1), never a hand-rolled button (CLAUDE.md §11: reuse, don't
              duplicate). Both a fresh pick AND this X funnel through the SAME
              `onChange`/`setVacancyId`, which reverts whatever the PREVIOUS vacancy
              auto-filled and is still untouched (useVacancyPrefillApply). */}
          {(labelId: string) => (
            <CreatableSelect value={vacancyId || null} onChange={setVacancyId} allowCreate={false}
              placeholder={t('placement.noVacancy')} menuWidth={340} clearable clearLabel={t('work.vacancy')}
              aria-labelledby={labelId}
              options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
          )}
        </F>
      )}

      {/* Branch mismatch (phase 3): candidate branch ≠ customer branch → calm
          inline choice. Default: only this match; opt-in: move the candidate. */}
      {branchMismatch && (
        <div role="group" aria-label={t('placement.branchMismatch')}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 11px', borderRadius: 8, fontSize: 12,
            color: 'var(--color-warning)', background: tintBg('var(--color-warning)'),
            border: tintBorder('var(--color-warning)') }}>
          <span style={{ fontWeight: 600 }}>
            {t('placement.branchMismatchDesc', { candidate: candBranch?.name || '—', customer: detail?.branch?.name || '—' })}
          </span>
          {(['match', 'candidate'] as const).map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="radio" name="branch-mismatch" checked={mismatchChoice === v} onChange={() => setMismatchChoice(v)} />
              {t(v === 'match' ? 'placement.branchKeep' : 'placement.branchMove')}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
