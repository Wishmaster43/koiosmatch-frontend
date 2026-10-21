import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { TFunction } from 'i18next'
// Pure helper from the side-effect-free module, never from `formatters` (DATETIME-IMPORT-LES).
import { formatFileSizeMb } from '@/lib/numberFormat'

// The upload surfaces the server policy knows (UPLOAD-POLICY-1).
export type UploadSurface = 'documents' | 'cv_parse' | 'import'

// One surface: lower-case extensions without dot; mimes and ceiling only come from the server.
export interface UploadSurfacePolicy {
  extensions: string[]
  mimes?: string[]
  max_bytes?: number | null
}

export type UploadPolicy = Partial<Record<UploadSurface, UploadSurfacePolicy>>

// Seed table (contract draft): used until the server value arrives, which then wins per surface.
export const UPLOAD_POLICY_SEED: Record<UploadSurface, UploadSurfacePolicy> = {
  documents: { extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'ods', 'jpg', 'jpeg', 'png', 'heic', 'txt'] },
  cv_parse: { extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
  import: { extensions: ['csv', 'txt', 'xlsx'] },
}

export type UploadCheck =
  | { ok: true }
  | { ok: false; reason: 'type'; allowed: string[] }
  | { ok: false; reason: 'size'; maxBytes: number }

// Module store: the server policy (or null) layered over the seed.
let serverPolicy: UploadPolicy | null = null
let effective: Record<UploadSurface, UploadSurfacePolicy> = { ...UPLOAD_POLICY_SEED }
const listeners = new Set<() => void>()

// Rebuilds the effective policy, server value per surface over the seed.
function rebuild(): void {
  effective = {
    documents: serverPolicy?.documents ?? UPLOAD_POLICY_SEED.documents,
    cv_parse: serverPolicy?.cv_parse ?? UPLOAD_POLICY_SEED.cv_parse,
    import: serverPolicy?.import ?? UPLOAD_POLICY_SEED.import,
  }
}

// Stores the server policy (null restores the seed) and notifies subscribers.
export function setUploadPolicy(p: UploadPolicy | null): void {
  serverPolicy = p
  rebuild()
  listeners.forEach((fn) => fn())
}

// The effective policy; the object identity is stable between changes.
export function getUploadPolicy(): Record<UploadSurface, UploadSurfacePolicy> {
  return effective
}

// Subscribe to policy changes; returns the unsubscribe function.
export function subscribeUploadPolicy(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// The `accept` string: dotted extensions plus the mimes when the server sent them.
export function acceptFor(surface: UploadSurface): string {
  const p = effective[surface]
  return [...p.extensions.map((e) => `.${e}`), ...(p.mimes ?? [])].join(',')
}

// Client-side pre-check of a picked file against the surface policy.
export function checkUploadFile(surface: UploadSurface, file: { name: string; size: number }): UploadCheck {
  const p = effective[surface]
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : ''
  if (!p.extensions.includes(ext)) return { ok: false, reason: 'type', allowed: p.extensions }
  if (typeof p.max_bytes === 'number' && file.size > p.max_bytes) {
    return { ok: false, reason: 'size', maxBytes: p.max_bytes }
  }
  return { ok: true }
}

// Refusal sentence with the same wording as the 422 codes; empty for an accepted file.
export function uploadRefusalText(result: UploadCheck, t: TFunction, locale = 'nl-NL'): string {
  if (result.ok) return ''
  if (result.reason === 'type') return t('common:upload.typeNotAllowed', { allowed: result.allowed.join(', ') })
  return t('common:upload.tooLargeMax', { max: formatFileSizeMb(result.maxBytes, locale) })
}

// Hook: the accept string and a checker for one surface, live with the store.
export function useUploadPolicy(surface: UploadSurface): { accept: string; check: (file: { name: string; size: number }) => UploadCheck } {
  const sp = useSyncExternalStore(subscribeUploadPolicy, getUploadPolicy, getUploadPolicy)[surface]
  const accept = useMemo(() => [...sp.extensions.map((e) => `.${e}`), ...(sp.mimes ?? [])].join(','), [sp])
  // sp is the dependency that re-creates the checker when the policy changes.
  const check = useCallback((file: { name: string; size: number }) => (sp ? checkUploadFile(surface, file) : { ok: true as const }), [surface, sp])
  return { accept, check }
}
