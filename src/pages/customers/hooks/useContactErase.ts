/**
 * useContactErase — ONIX K-005: POST the password-confirmed erase of ONE contact
 * person. Request body typed from the generated spec (no 2xx schema shipped for
 * this path yet, so the success shape below is hand-written, per the brief).
 */
import api, { unwrap } from '@/lib/api'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

type EraseBody = operations['postCustomersCustomerContactsContactErase']['requestBody']['content']['application/json']
// Hand-written: the generated spec carries no 2xx schema for this route yet.
interface EraseResponse { message: string; contact_id: string }

// Erase one contact person's personal data, re-confirmed with the signed-in user's own password.
export async function eraseContact(customerId: Id, contactId: Id, password: string): Promise<EraseResponse> {
  const body: EraseBody = { password }
  const res = await api.post(`/customers/${customerId}/contacts/${contactId}/erase`, body)
  return unwrap<EraseResponse>(res)
}
