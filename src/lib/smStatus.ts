// Shiftmanager's OWN external vocabulary (§10 sm_-mirror): these values are
// deliberately non-English (§0.1 covers our own identifiers, not external API
// data) and are never a tenant lookup — that would be a fake affordance, since
// Shiftmanager itself defines and owns this status set, not the tenant.
export const SM_STATUS = {
  ACTIVE: 'actief',
  INACTIVE: 'nietactief',
  INTAKE: 'intake',
  DELETED: 'verwijderd',
} as const

// One normalisation for every SM-status count: lowercase, falling back to
// 'onbekend' (unknown) when the field is missing.
export const statusOf = (c: { status?: string | null }) => (c.status || 'onbekend').toLowerCase()
