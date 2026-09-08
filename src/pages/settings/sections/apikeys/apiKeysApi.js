/**
 * apiKeysApi — all axios calls for the API-keys section, in one place (CLAUDE §10).
 *
 * The plaintext secret is returned ONLY by create + regenerate and is never
 * stored client-side beyond the one-time reveal. Everything else is normalised
 * through the shared unwrap/unwrapList adapters so call sites get a stable shape.
 */
import api, { unwrap, unwrapList } from '@/lib/api'

// List all keys for the active tenant (secrets are never included).
export const listApiKeys = () => api.get('/api-keys').then(unwrapList)

// Full detail incl. scopes, allowed_ips and contact (no secret).
export const getApiKey = (id) => api.get(`/api-keys/${id}`).then(unwrap)

// Create a key; the response carries the plaintext secret exactly once.
export const createApiKey = (body) => api.post('/api-keys', body).then((r) => r.data)

// Update general fields + status + scopes (never the secret).
export const updateApiKey = (id, body) => api.put(`/api-keys/${id}`, body).then(unwrap)

// Revoke/delete a key.
export const deleteApiKey = (id) => api.delete(`/api-keys/${id}`)

// Rotate the secret; the response carries the new plaintext secret exactly once.
export const regenerateApiKey = (id) => api.post(`/api-keys/${id}/regenerate`).then((r) => r.data)

// K-282: promote this key to primary via PATCH (backend bundle H). The model keeps
// exactly one active primary — promoting one auto-demotes the previous primary
// server-side (audited) — so every caller must reload the list after this resolves.
export const setApiKeyPrimary = (id) => api.patch(`/api-keys/${id}`, { type: 'primary' }).then(unwrap)

// SCOPE-LEVEL-READONLY-1 (DRAFT-SETTINGS-CATALOG-1 §5): the levels the backend offers per
// scope entity ({entity, levels}[]); read-only entities list only 'read'. Tolerant of both
// the {data: [...]} envelope and a bare array.
export const listScopeEntities = () => api.get('/api-keys/scope-entities').then((r) => (Array.isArray(r.data) ? r.data : (r.data?.data ?? [])))
