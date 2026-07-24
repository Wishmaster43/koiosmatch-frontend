/**
 * RelationsSection — the "Relaties" block of the placement form: optional
 * candidate picker, customer→location→department→contact cascade (typeable
 * searchable pickers, allowCreate=false — never a free-text create for a real
 * relational id), inline contact creation, function/owner, optional vacancy,
 * and the branch-mismatch banner. Split out of MatchPlacementModal.tsx (audit
 * R1 item 1, MUST-SPLIT) — pure presentational, all state/handlers via props
 * from useMatchPlacementForm.
 *
 * Danny 24-07: Vestiging AND Recruiter are now searchable CreatableSelects
 * (both were a plain SelectMenu); the contact picker shows "Naam —
 * Functietitel" so same-named contacts stay distinguishable; the inline
 * new-contact form gained a searchable Functie picker + phone/mobile fields
 * and a duplicate-contact preflight message; the "+ nieuw" affordance is now
 * the shared `DrawerAddButton` (the house soft-tint chip) instead of a bare
 * text link. No plain SelectMenu is left in this section.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { FormField as F } from './FormField'
import { lbl, errMsg, row2, row3Even, pickerMenuWidth, input } from './styles'
import type { CascadeOption, CascadeLocation, CascadeDepartment, CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { CustomerOption } from '@/pages/vacancies/hooks/useCustomerOptions'
import type { VacancyOption } from '@/pages/candidates/hooks/useVacancyOptions'
import type { LocationOption } from '@/lib/useLocations'
import type { Id } from '@/types/common'

interface UserLike { id?: Id; name?: string }
interface NewContact { first_name: string; last_name: string; email: string; phone: string; mobile: string; function: string }

// A relational option list → { value, label } pairs for the shared pickers.
const opt = (arr: Array<{ id?: Id; name?: string }>) => arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

// A contact's function/job title — the key name varies by response shape (Danny
// 24-07 live screenshot: same-named contacts were indistinguishable), so read it
// tolerantly and never leave a dangling separator when it's absent.
const contactFunctionOf = (c: CascadeOption) => c.function || c.function_title || c.position || c.job_title || ''
const contactOpt = (arr: CascadeOption[]) => arr.map(c => {
  const fn = contactFunctionOf(c)
  return { value: String(c.id), label: fn ? `${c.name ?? '—'} — ${fn}` : (c.name ?? '—') }
})

export default function RelationsSection({
  t, errors,
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
  contactFunctions: string[]; contactFunctionsAllowFreeEntry: boolean
  func: string; setFunc: (v: string) => void; functions: string[]
  ownerId: string; setOwnerId: (v: string) => void; users: UserLike[]
  // Vestiging picker (7.4) — the TENANT's own establishments, distinct from the
  // customer-cascade `locations` above (a customer's nested address).
  branchId: string; setBranchId: (v: string) => void; setBranchDirty: (v: boolean) => void; branchLocations: LocationOption[]
  vacancyId: string; setVacancyId: (v: string) => void; vacancyOptions: VacancyOption[]
  branchMismatch: boolean; candBranch: { id: Id | null; name: string } | null; detail: CustomerCascadeDetail | null
  mismatchChoice: 'placement' | 'candidate'; setMismatchChoice: (v: 'placement' | 'candidate') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Candidate picker — only when the modal wasn't opened from a candidate.
          Searchable (job 18): the candidate list can run into the hundreds. */}
      {!fixedCandidateId && (
        <F label={t('placement.candidate')} error={errors.pickedCandidateId}>
          <CreatableSelect value={pickedCandidateId || null} onChange={setPickedCandidateId} allowCreate={false}
            placeholder={t('placement.pickCandidate')} menuWidth={pickerMenuWidth}
            options={candidateOptions.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
        </F>
      )}
      <div style={row2}>
        {/* Klant/locatie — typeable searchable pickers (job 17/18), never free-text
            create (allowCreate={false}: a customer/location is a real relational id). */}
        <F label={t('placement.customer')} error={errors.customerId}>
          <CreatableSelect value={customerId || null} onChange={setCustomerId} allowCreate={false}
            placeholder={t('placement.pickCustomer')} menuWidth={pickerMenuWidth}
            options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />
        </F>
        <F label={t('placement.location')} error={errors.locationId}>
          <CreatableSelect value={locationId || null} onChange={v => { setLocationId(v); setDepartmentId('') }}
            allowCreate={false} menuWidth={pickerMenuWidth}
            placeholder={customerId ? t('placement.pickLocation') : t('placement.pickCustomerFirst')}
            options={opt(locations)} />
        </F>
      </div>
      <div style={row2}>
        {/* Afdeling/contactpersoon — same searchable pattern. allowCreate={false}
            was missing here (live-check finding, kandidaten-ronde-2 punt C.2.1):
            a department is a real relational id like customer/location/contact,
            never a free-text create — the file header already claimed this. */}
        <F label={t('placement.department')} error={errors.departmentId}>
          <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
            placeholder={t('placement.optional')} menuWidth={pickerMenuWidth} options={opt(departments)} />
        </F>
        <div>
          <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('placement.contact')}</span>
            {/* House soft-tint chip (Danny 24-07 screenshot feedback) — the shared
                DrawerAddButton, not a bare text link. */}
            {customerId && !creatingContact && (
              <DrawerAddButton onClick={() => setCreatingContact(true)} label={t('placement.newContact')} />
            )}
          </div>
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
                  options={contactFunctions.map(f => ({ value: f, label: f }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input type="tel" value={nc.phone} onChange={e => setNc(p => ({ ...p, phone: e.target.value }))} placeholder={t('placement.phone')} style={{ ...input, height: 30 }} />
                <input type="tel" value={nc.mobile} onChange={e => setNc(p => ({ ...p, mobile: e.target.value }))} placeholder={t('placement.mobile')} style={{ ...input, height: 30 }} />
              </div>
              {/* Duplicate-contact preflight (Danny 24-07): blocks the save, names the
                  existing match — the backend enforces no uniqueness on these fields. */}
              {duplicateContact && (
                <div role="alert" style={{ fontSize: 11.5, color: 'var(--color-warning)',
                  background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', borderRadius: 6, padding: '6px 8px' }}>
                  {t('placement.duplicateContact', { name: duplicateContact.name ?? '—' })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => { setCreatingContact(false); setDuplicateContact(null); setNc({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' }) }} style={{ height: 28, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
                <button onClick={saveContact} disabled={!nc.first_name.trim() || !nc.last_name.trim()} style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', opacity: (nc.first_name.trim() && nc.last_name.trim()) ? 1 : 0.4 }}>{t('common:save')}</button>
              </div>
            </div>
          ) : (
            <CreatableSelect value={contactId || null} onChange={setContactId} allowCreate={false} menuWidth={pickerMenuWidth}
              placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={contactOpt(contacts)} />
          )}
          {errors.contactId && <div style={errMsg}>{t('common:required')}</div>}
        </div>
      </div>
      <div style={row3Even}>
        {/* Functie — searchable (tenant lookup, can run to dozens of job titles);
            Recruiter is now searchable too (Danny 24-07 addendum, same treatment as
            Contractsoort/Vestiging/CAO) — stays optional exactly like before: no
            pick = empty value, same placeholder, no dedicated clear affordance
            (neither widget offers one; only the STARTING empty state carried the
            "none" meaning, unchanged here). Vestiging (7.4) is searchable too
            (point 2). */}
        <F label={t('placement.function')} error={errors.func}>
          <CreatableSelect value={func || null} onChange={setFunc} allowCreate={false}
            placeholder={t('placement.pickFunction')} menuWidth={pickerMenuWidth}
            options={functions.map(f => ({ value: f, label: f }))} />
        </F>
        <F label={t('placement.owner')} error={errors.ownerId}>
          <CreatableSelect value={ownerId || null} onChange={setOwnerId} allowCreate={false}
            placeholder={t('placement.optional')} menuWidth={pickerMenuWidth}
            options={users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))} />
        </F>
        {/* Vestiging (7.4) — proposes from the customer's own branch, then the
            recruiter's, then the tenant default (useBranchDefault); editing it by
            hand freezes the proposal (setBranchDirty), same pattern as cost centre. */}
        <F label={t('placement.branch')} error={errors.branchId}>
          <CreatableSelect value={branchId || null} onChange={v => { setBranchDirty(true); setBranchId(v) }}
            allowCreate={false} menuWidth={pickerMenuWidth} placeholder={t('placement.optional')}
            options={branchLocations.map(l => ({ value: String(l.value), label: l.label }))} />
        </F>
      </div>
      {/* Vacature — searchable, mirrors PlanIntakeModal's vacancy picker. */}
      <F label={t('placement.vacancyOptional')} error={errors.vacancyId}>
        <CreatableSelect value={vacancyId || null} onChange={setVacancyId} allowCreate={false}
          placeholder={t('placement.noVacancy')} menuWidth={340}
          options={vacancyOptions.map(v => ({ value: String(v.value), label: v.client ? `${v.label} · ${v.client}` : v.label }))} />
      </F>

      {/* Vestiging-mismatch (fase 3): candidate branch ≠ customer branch → calm
          inline choice. Default: only this placement; opt-in: move the candidate. */}
      {branchMismatch && (
        <div role="group" aria-label={t('placement.branchMismatch')}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 11px', borderRadius: 8, fontSize: 12,
            color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
          <span style={{ fontWeight: 600 }}>
            {t('placement.branchMismatchDesc', { candidate: candBranch?.name || '—', customer: detail?.branch?.name || '—' })}
          </span>
          {(['placement', 'candidate'] as const).map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'var(--text)' }}>
              <input type="radio" name="branch-mismatch" checked={mismatchChoice === v} onChange={() => setMismatchChoice(v)} />
              {t(v === 'placement' ? 'placement.branchKeep' : 'placement.branchMove')}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
