/**
 * Locale sentences that must track a backend policy: the mailbox tenant_policy reason (ONIX T-009)
 * and the CV type refusal (ONIX P-014, UPLOAD-POLICY-1).
 */
import { describe, it, expect } from 'vitest'
import { getUploadPolicy } from '@/lib/uploadPolicy'

type Tree = { [key: string]: string | Tree }
const LANGS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'] as const
const mods = import.meta.glob('./locales/*/{settings,auth,candidates}.json', { eager: true, import: 'default' }) as Record<string, Tree>
// Resolve a dotted path inside a locale file to its sentence.
const text = (l: string, ns: string, path: string): string =>
  path.split('.').reduce<Tree | string>((cur, part) => (cur as Tree)[part], mods[`./locales/${l}/${ns}.json`]) as string

describe('tenant_policy mailbox sentence', () => {
  it.each(LANGS)('%s names Microsoft 365', l => {
    const texts = [
      text(l, 'settings', 'email.oauthReasonTenantPolicy'),
      text(l, 'settings', 'email.tenantPolicy'),
      text(l, 'auth', 'profile.email.oauthReasonTenantPolicy'),
      text(l, 'auth', 'profile.email.tenantPolicy'),
    ]
    for (const text of texts) expect(text).toContain('Microsoft 365')
  })
})

describe('CV refusal sentence', () => {
  it.each(LANGS)('%s lists exactly the cv_parse extensions of the upload policy', l => {
    const sentence = text(l, 'candidates', 'modal.cv.error.notPdf')
    const allowed = getUploadPolicy().cv_parse.extensions
    for (const ext of allowed) expect(sentence).toMatch(new RegExp(`\\b${ext}\\b`))
    for (const gone of ['gif', 'webp', 'xlsx']) expect(sentence).not.toContain(gone)
  })
})
