/** Shared fixtures for the CandidateLookupsSettings suites (no vi.mock here: mocks stay per test file). */
import i18n from '@/i18n'

export const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture funnel stage's tenant-picked colour, not a style rule.
export const stage = (over = {}) => ({ id: 'f1', value: 'applied', label: 'Gesolliciteerd', color: '#3B8FD4', is_default: false, ...over })
