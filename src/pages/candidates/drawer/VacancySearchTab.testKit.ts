/** Shared seed DATA for the VacancySearchTab suites (plain data, no mocks). */

export interface SeedOption { value: string; label: string; color: string }

/* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_CANDIDATE_TYPES, not a UI colour choice */
// Fresh copy of the two-type Contractvorm lookup each call, so a test can mutate its own.
export const candidateTypesSeed = (): SeedOption[] => [
  { value: 'freelance', label: 'ZZP', color: '#5FB0AC' },
  { value: 'on_call', label: 'Oproepkracht', color: '#6E8FD6' },
]

// typeMeta stand-in: the matching type, else a neutral fallback carrying the raw value.
export const typeMetaFrom = (types: SeedOption[], v?: string | null) =>
  types.find(ct => ct.value === v) ?? { value: v ?? '', label: v ?? '', color: '#6B7280' }
/* eslint-enable no-restricted-syntax */

/* eslint-disable no-restricted-syntax -- seed DATA mirroring DEFAULT_VACANCY_STATUSES, not a UI colour choice */
// Return value of the mocked useVacancyLookups: 'open' is the one the tenant default should match.
export const vacancyLookupsSeed = () => ({
  statuses: [
    { value: 'open', label: 'Open', color: '#79B58E' },
    { value: 'closed', label: 'Gesloten', color: '#8A94A6' },
  ],
  statusMeta: (v?: string | null) => ({ value: v ?? '', label: v === 'open' ? 'Open' : 'Gesloten', color: '#79B58E' }),
})
/* eslint-enable no-restricted-syntax */
