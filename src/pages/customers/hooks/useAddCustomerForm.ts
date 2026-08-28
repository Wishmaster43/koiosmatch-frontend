/**
 * useAddCustomerForm — the create-form state for AddCustomerModal, extracted
 * per the ~400-line split trigger (§0.3): form state plus its three
 * default-seeding effects (phase / status / owner) and the country→province
 * cascade, unchanged in behaviour from the former inline container logic.
 */
import { useState, useEffect } from 'react'
import { useProvinces } from '@/hooks/useProvinces'
import type { Id } from '@/types/common'
import type { CustomerForm } from '../AddCustomerModal'

interface UseAddCustomerFormArgs {
  defaultPhase: string
  defaultStatusValue: string
  // The logged-in user, only when they actually appear in the tenant's
  // assignable users list (owner_id is validated against tenant users) —
  // the caller (AddCustomerModal) already computes this against `users`.
  meIsAssignable: boolean
  me: { id?: Id; name?: string } | null
}

// Seeds the form's default phase/status/owner once their lookups resolve, and
// cascades the province list on the picked country — mirrors AddCandidateModal.
export function useAddCustomerForm({ defaultPhase, defaultStatusValue, meIsAssignable, me }: UseAddCustomerFormArgs) {
  const [form, setForm] = useState<CustomerForm>({
    name: '', status: defaultStatusValue, ownerId: '', industry: '', city: '',
    phase: defaultPhase,
    branchId: '', website: '', employeeCount: '', toneOfVoice: '', costCenter: '', billingEmail: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', province: '', country: '',
    cocNumber: '', vatNumber: '',
  })

  // The lookup arrives async (one cached GET), so seed the default phase once it lands —
  // but never overwrite a phase the user already picked.
  useEffect(() => {
    setForm(f => (f.phase ? f : { ...f, phase: defaultPhase }))
  }, [defaultPhase])

  // Same pattern for the (now hidden) status default — the recruiter never picks it
  // here, so this is the ONLY thing that ever sets it.
  useEffect(() => {
    setForm(f => (f.status ? f : { ...f, status: defaultStatusValue }))
  }, [defaultStatusValue])

  // Propose the current user as account manager ONCE they are known to be
  // assignable; a value the recruiter already picked (or picks later) is never
  // overwritten — the functional update only fires while ownerId is still empty.
  useEffect(() => {
    if (meIsAssignable) setForm(f => (f.ownerId ? f : { ...f, ownerId: String(me!.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to assignability resolving, mirrors AddApplicationModal's owner-default effect
  }, [meIsAssignable])

  // KLANT-ADRES-1: province list CASCADES on the picked country, same shared hook
  // (and same clear-on-mismatch behaviour) as the candidate's home address.
  const { provinces } = useProvinces(form.country)
  // Clears the province the moment the resolved list for the newly picked country no
  // longer contains it, so a stale country's previous province can never linger silently.
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setForm(f => ({ ...f, province: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  return { form, setForm, provinces }
}
