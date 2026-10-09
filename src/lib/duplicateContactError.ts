/**
 * duplicateContactError — recognise the BE's 422 for a duplicate contact detail
 * (ONIX N-001): the bag carries `<field>: ["contacts.duplicate.<field>"]` plus
 * `duplicate_contact_id: ["<uuid>"]`. Pure; returns null for any other error.
 */
interface ErrBody { response?: { data?: { errors?: Record<string, unknown> } } }

// The bag key that carries the existing contact's id; never a form field.
export const DUPLICATE_CONTACT_ID_KEY = 'duplicate_contact_id'

const DUPLICATE_KEY = /^contacts\.duplicate\.(\w+)$/

// First message of a bag entry, whether it is an array or a bare string.
const firstMessage = (value: unknown): string | null => {
  const msg = Array.isArray(value) ? value[0] : value
  return typeof msg === 'string' ? msg : null
}

// Field name + existing contact id from a duplicate-contact 422, else null.
export function duplicateContactError(err: unknown): { field: string; existingId: string | null } | null {
  const bag = (err as ErrBody)?.response?.data?.errors
  if (!bag || typeof bag !== 'object') return null
  for (const value of Object.values(bag)) {
    const match = DUPLICATE_KEY.exec(firstMessage(value) ?? '')
    if (match) return { field: match[1], existingId: firstMessage(bag[DUPLICATE_CONTACT_ID_KEY]) }
  }
  return null
}
