/**
 * RelationsSection — the "Relaties" block of the placement form: optional
 * candidate picker, customer→location→department→contact cascade (typeable
 * searchable pickers, allowCreate=false — never a free-text create for a real
 * relational id), inline contact creation, function/owner, optional vacancy,
 * and the branch-mismatch banner. Split out of MatchPlacementModal.tsx (audit
 * R1 item 1, MUST-SPLIT) — pure presentational, all state/handlers via props
 * from useMatchPlacementForm.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SelectMenu from '@/components/ui/SelectMenu'
import { FormField as F } from './FormField'
import { lbl, errMsg, row2, pickerMenuWidth, input } from './styles'
import type { CascadeOption, CascadeLocation, CascadeDepartment, CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { CustomerOption } from '@/pages/vacancies/hooks/useCustomerOptions'
import type { VacancyOption } from '@/pages/candidates/hooks/useVacancyOptions'
import type { Id } from '@/types/common'

interface UserLike { id?: Id; name?: string }
interface NewContact { first_name: string; last_name: string; email: string; phone: string }

// A relational option list → { value, label } pairs for the shared pickers.
const opt = (arr: Array<{ id?: Id; name?: string }>) => arr.map(x => ({ value: String(x.id), label: x.name ?? '—' }))

export default function RelationsSection({
  t, errors,
  fixedCandidateId, pickedCandidateId, setPickedCandidateId, candidateOptions,
  customerId, setCustomerId, customerOptions,
  locationId, setLocationId, locations,
  departmentId, setDepartmentId, departments,
  contactId, setContactId, contacts,
  creatingContact, setCreatingContact, nc, setNc, saveContact,
  func, setFunc, functions,
  ownerId, setOwnerId, users,
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
  func: string; setFunc: (v: string) => void; functions: string[]
  ownerId: string; setOwnerId: (v: string) => void; users: UserLike[]
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
        {/* Afdeling/contactpersoon — same searchable pattern. */}
        <F label={t('placement.department')} error={errors.departmentId}>
          <CreatableSelect value={departmentId || null} onChange={setDepartmentId}
            placeholder={t('placement.optional')} menuWidth={pickerMenuWidth} options={opt(departments)} />
        </F>
        <div>
          <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('placement.contact')}</span>
            {customerId && !creatingContact && (
              <button onClick={() => setCreatingContact(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 11, fontWeight: 600, padding: 0 }}>+ {t('placement.newContact')}</button>
            )}
          </div>
          {creatingContact ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input value={nc.first_name} onChange={e => setNc(p => ({ ...p, first_name: e.target.value }))} placeholder={t('placement.firstName')} style={{ ...input, height: 30 }} />
                <input value={nc.last_name} onChange={e => setNc(p => ({ ...p, last_name: e.target.value }))} placeholder={t('placement.lastName')} style={{ ...input, height: 30 }} />
              </div>
              <input value={nc.email} onChange={e => setNc(p => ({ ...p, email: e.target.value }))} placeholder={t('placement.email')} style={{ ...input, height: 30 }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => { setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '' }) }} style={{ height: 28, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common:cancel')}</button>
                <button onClick={saveContact} disabled={!nc.first_name.trim() || !nc.last_name.trim()} style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', opacity: (nc.first_name.trim() && nc.last_name.trim()) ? 1 : 0.4 }}>{t('common:save')}</button>
              </div>
            </div>
          ) : (
            <CreatableSelect value={contactId || null} onChange={setContactId} allowCreate={false} menuWidth={pickerMenuWidth}
              placeholder={customerId ? t('placement.pickContact') : t('placement.pickCustomerFirst')} options={opt(contacts)} />
          )}
          {errors.contactId && <div style={errMsg}>{t('common:required')}</div>}
        </div>
      </div>
      <div style={row2}>
        {/* Functie — searchable (tenant lookup, can run to dozens of job titles);
            Recruiter stays a plain SelectMenu (small, not in job 18's long-list scope). */}
        <F label={t('placement.function')} error={errors.func}>
          <CreatableSelect value={func || null} onChange={setFunc} allowCreate={false}
            placeholder={t('placement.pickFunction')} menuWidth={pickerMenuWidth}
            options={functions.map(f => ({ value: f, label: f }))} />
        </F>
        <F label={t('placement.owner')} error={errors.ownerId}>
          <SelectMenu value={ownerId || null} onChange={setOwnerId} placeholder={t('placement.optional')}
            options={users.map(u => ({ value: String(u.id), label: u.name ?? '—' }))} />
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
