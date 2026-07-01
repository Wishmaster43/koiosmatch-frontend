/**
 * messagingApi — axios calls for the messaging settings (limits, costs, retention).
 *
 * Shapes follow the backend contract:
 *   GET/PUT /settings/messaging-limits   — PUT only accepts values ≤ ceiling
 *   GET     /settings/messaging-costs     — { usage, cost{numbers,waba_messages,base,total}, by_number[] }
 *   GET/PUT /settings/message-retention   — tenant-wide retention
 *   GET/PUT /profile/message-retention    — the current user's own retention
 * Effective retention = the lowest of tenant + own (enforced server-side too).
 */
import api, { unwrap } from '@/lib/api'

// Messaging limits (tenant): the editable cap + its hard ceiling.
export const getLimits = () => api.get('/settings/messaging-limits').then(unwrap)
export const putLimits = (body) => api.put('/settings/messaging-limits', body).then(unwrap)

// Messaging costs (tenant): read-only usage + cost breakdown.
export const getCosts = () => api.get('/settings/messaging-costs').then(unwrap)

// Retention — tenant-wide.
export const getTenantRetention = () => api.get('/settings/message-retention').then(unwrap)
export const putTenantRetention = (body) => api.put('/settings/message-retention', body).then(unwrap)

// Retention — the current user's own.
export const getProfileRetention = () => api.get('/profile/message-retention').then(unwrap)
export const putProfileRetention = (body) => api.put('/profile/message-retention', body).then(unwrap)
