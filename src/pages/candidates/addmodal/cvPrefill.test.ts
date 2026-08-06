/**
 * cvPrefill — the safety rules of the CV parse, tested without a component because
 * they are pure. What is guarded here:
 *  - the whitelist: an unknown payload key (summary/motivation/notes — a care CV's
 *    health-adjacent prose) can never reach the form;
 *  - never overwrite: a value the recruiter typed always wins over the parse;
 *  - strict dates: an ambiguous/implausible birthdate is left empty, never guessed.
 */
import { describe, it, expect } from 'vitest'
import { buildCvPrefill, toIsoBirthDate } from './cvPrefill'
import type { ParsedCvFields } from './cvPrefill'
import type { FormState } from '../AddCandidateModal'

// An untouched create form — the state buildCvPrefill maps against.
const emptyForm = (over: Partial<FormState> = {}): FormState => ({
  firstName: '', middleName: '', lastName: '', functionTitle: '',
  email: '', phone: '', mobile: '', dateOfBirth: '', gender: '',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '',
  ownerId: '', summary: '', linkedin: '', ...over,
})

describe('toIsoBirthDate', () => {
  it('passes an ISO date through', () => {
    expect(toIsoBirthDate('1985-03-12')).toBe('1985-03-12')
    expect(toIsoBirthDate('1985-3-2')).toBe('1985-03-02')
  })

  it('reads the numeric Dutch order as DD-MM-YYYY (also with / and .)', () => {
    expect(toIsoBirthDate('12-03-1985')).toBe('1985-03-12')
    expect(toIsoBirthDate('12/03/1985')).toBe('1985-03-12')
    expect(toIsoBirthDate('12.03.1985')).toBe('1985-03-12')
  })

  it('refuses anything it cannot read unambiguously', () => {
    expect(toIsoBirthDate('12 maart 1985')).toBeNull()
    expect(toIsoBirthDate('March 1985')).toBeNull()
    expect(toIsoBirthDate('1985')).toBeNull()
    expect(toIsoBirthDate('12-03-85')).toBeNull()
    expect(toIsoBirthDate('')).toBeNull()
    expect(toIsoBirthDate(null)).toBeNull()
  })

  it('refuses a non-existent or implausible date instead of shifting it', () => {
    expect(toIsoBirthDate('31-02-1990')).toBeNull()
    expect(toIsoBirthDate('1990-13-01')).toBeNull()
    expect(toIsoBirthDate('12-03-1885')).toBeNull()
    expect(toIsoBirthDate(`12-03-${new Date().getFullYear() + 1}`)).toBeNull()
  })
})

describe('buildCvPrefill · whitelist', () => {
  it('maps every supported key, incl. postcode → postalCode', () => {
    const fields: ParsedCvFields = {
      first_name: 'Anna', last_name: 'de Vries', email: 'anna@example.nl',
      phone: '0201234567', mobile: '0612345678', street: 'Hoofdstraat',
      house_number: '12a', postcode: '1011 AB', city: 'Amsterdam', date_of_birth: '12-03-1985',
    }
    const result = buildCvPrefill(fields, emptyForm())
    expect(result.patch).toEqual({
      firstName: 'Anna', lastName: 'de Vries', email: 'anna@example.nl',
      phone: '0201234567', mobile: '0612345678', street: 'Hoofdstraat',
      houseNumber: '12a', postalCode: '1011 AB', city: 'Amsterdam', dateOfBirth: '1985-03-12',
    })
    expect(result.filled).toHaveLength(10)
  })

  it('NEVER lets a free-text key through — not even one the backend adds later', () => {
    const fields = {
      first_name: 'Anna',
      // The exact prose Danny called out: health information that must never land
      // automatically in a dossier that travels into exports and proposal CVs.
      summary: 'Na mijn burn-out weer opgebouwd',
      profile_text: 'Ik ben sinds mijn ziekte parttime beschikbaar',
      remarks: 'Chronische aandoening',
      motivation: 'Graag weer aan de slag',
    } as unknown as ParsedCvFields
    const result = buildCvPrefill(fields, emptyForm())
    expect(result.patch).toEqual({ firstName: 'Anna' })
    const written = JSON.stringify(result.patch)
    expect(written).not.toContain('burn-out')
    expect(written).not.toContain('ziekte')
    expect(written).not.toContain('Chronische')
  })

  it('ignores blank and whitespace-only values', () => {
    const result = buildCvPrefill({ first_name: '   ', last_name: '', city: null }, emptyForm())
    expect(result.patch).toEqual({})
    expect(result.filled).toEqual([])
  })
})

describe('buildCvPrefill · never overwrites what the recruiter typed', () => {
  it('skips a field that already has a value and reports it', () => {
    const result = buildCvPrefill(
      { first_name: 'Anna', last_name: 'de Vries', city: 'Amsterdam' },
      emptyForm({ firstName: 'Annelies', city: 'Utrecht' }),
    )
    expect(result.patch).toEqual({ lastName: 'de Vries' })
    expect(result.skipped.sort()).toEqual(['city', 'firstName'])
    expect(result.filled).toEqual(['lastName'])
  })

  it('leaves a typed birthdate alone', () => {
    const result = buildCvPrefill({ date_of_birth: '12-03-1985' }, emptyForm({ dateOfBirth: '1990-01-01' }))
    expect(result.patch).toEqual({})
    expect(result.skipped).toEqual(['dateOfBirth'])
    expect(result.unreadableDate).toBe(false)
  })
})

describe('buildCvPrefill · reporting', () => {
  it('flags an unreadable birthdate instead of filling a guess', () => {
    const result = buildCvPrefill({ date_of_birth: 'lente 1985' }, emptyForm())
    expect(result.patch.dateOfBirth).toBeUndefined()
    expect(result.unreadableDate).toBe(true)
  })

  it('counts work experience and education, which this form cannot save', () => {
    const result = buildCvPrefill({
      first_name: 'Anna',
      work_experiences: [
        { company: 'Zorggroep A', position: 'Verzorgende IG', location: 'Utrecht', start_date: '2019', end_date: '2022' },
        { company: 'Thuiszorg B', position: 'Helpende', location: 'Amersfoort', start_date: '2022', end_date: null },
      ],
      educations: [{ degree: 'MBO Verzorgende IG', school: 'ROC', issue_date: '2018' }],
    }, emptyForm())
    expect(result.extras).toEqual({ experiences: 2, educations: 1 })
    // Counted only — no experience/education value is proposed for the form.
    expect(Object.keys(result.patch)).toEqual(['firstName'])
  })

  it('survives a payload with no arrays at all', () => {
    const result = buildCvPrefill({ first_name: 'Anna' }, emptyForm())
    expect(result.extras).toEqual({ experiences: 0, educations: 0 })
  })
})
