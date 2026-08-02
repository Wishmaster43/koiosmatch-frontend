/**
 * mapCvProposal / buildCvProposalDiff — the CV-proposal contract boundary.
 *
 * The two things this file has to prove are safety properties, not cosmetics:
 * (1) free text can NEVER survive the mapper, whatever the payload carries — a
 *     care CV routinely holds health-adjacent prose, and it must not reach a
 *     dossier that flows into exports and into the CV sent to a client;
 * (2) the diff reproduces CvParseProposalApplier's fill-blank-only rule exactly,
 *     including the candidate contract's `postcode` → `postal_code` rename, so
 *     the recruiter is never promised a fill the backend then skips.
 */
import { describe, it, expect } from 'vitest'
import { mapCvProposal, buildCvProposalDiff, CV_PROPOSAL_SCALAR_FIELDS } from './mapCvProposal'
import type { ApiCvParseProposal } from './mapCvProposal'

const raw = (over: Partial<ApiCvParseProposal> = {}): ApiCvParseProposal => ({
  id: 'p1',
  application_id: 'a1',
  status: 'pending',
  model: 'claude-x',
  created_at: '2026-08-01T09:00:00+02:00',
  fields: {
    first_name: 'Sanne', last_name: 'de Groot', email: 'sanne@example.test',
    phone: null, mobile: '0612345678', street: 'Dorpsstraat', house_number: '12',
    postcode: '1234 AB', city: 'Zwolle', date_of_birth: '1990-05-31',
    work_experiences: [], educations: [],
  },
  ...over,
})

describe('mapCvProposal', () => {
  it('maps the allow-listed scalars and trims them', () => {
    const p = mapCvProposal(raw({ fields: { ...raw().fields, first_name: '  Sanne  ' } }))
    expect(p.scalars.first_name).toBe('Sanne')
    expect(p.scalars.city).toBe('Zwolle')
    // A null field carries no value and is simply absent — never an empty row.
    expect(p.scalars.phone).toBeUndefined()
  })

  // THE safety test: any key outside the allow-list is dropped, and only its NAME
  // is kept so the UI can count it. Free text must never become renderable data.
  it('drops every field outside the allow-list, keeping only the key name', () => {
    const p = mapCvProposal(raw({
      fields: {
        ...raw().fields,
        summary: 'Na mijn burn-out ben ik weer opgebouwd in de ouderenzorg.',
        profile_text: 'Ik werk graag met dementerende ouderen.',
        remarks: 'Momenteel in behandeling.',
      },
    }))

    expect(p.droppedFieldKeys.sort()).toEqual(['profile_text', 'remarks', 'summary'])
    // No dropped VALUE survives anywhere in the mapped model.
    const serialised = JSON.stringify(p)
    expect(serialised).not.toContain('burn-out')
    expect(serialised).not.toContain('dementerende')
    expect(serialised).not.toContain('behandeling')
    // And the mapped scalars only ever hold allow-listed keys.
    expect(Object.keys(p.scalars).every(k => (CV_PROPOSAL_SCALAR_FIELDS as readonly string[]).includes(k))).toBe(true)
  })

  it('keeps only repeatable rows the applier would actually append', () => {
    const p = mapCvProposal(raw({
      fields: {
        ...raw().fields,
        work_experiences: [
          { company: 'Zorggroep Noord', position: 'Verzorgende IG', location: 'Zwolle', start_date: '2019', end_date: null },
          { company: null, position: 'Vrijwilliger', location: null, start_date: null, end_date: null },
          'not-an-object',
        ],
        educations: [
          { degree: 'MBO Verzorgende IG', school: 'Deltion', issue_date: '2018' },
          { degree: '', school: 'Onbekend', issue_date: null },
        ],
      },
    }))

    // CvParseProposalApplier skips a row without company/degree — so do we, or the
    // "these lines get added" count would over-promise.
    expect(p.experiences).toHaveLength(1)
    expect(p.experiences[0]).toEqual({ company: 'Zorggroep Noord', position: 'Verzorgende IG', location: 'Zwolle', startDate: '2019', endDate: '' })
    expect(p.educations).toHaveLength(1)
    expect(p.educations[0].degree).toBe('MBO Verzorgende IG')
  })

  it('reads an unknown status as pending and keeps accepted/rejected', () => {
    expect(mapCvProposal(raw({ status: 'weird' })).status).toBe('pending')
    expect(mapCvProposal(raw({ status: 'accepted' })).status).toBe('accepted')
    expect(mapCvProposal(raw({ status: 'rejected' })).status).toBe('rejected')
  })

  it('carries the applied/skipped summary an accept response adds', () => {
    const p = mapCvProposal(raw({ status: 'accepted', applied_fields: ['mobile', 'city'], skipped_fields: ['email'] }))
    expect(p.appliedFields).toEqual(['mobile', 'city'])
    expect(p.skippedFields).toEqual(['email'])
  })

  it('survives an empty payload without throwing', () => {
    const p = mapCvProposal()
    expect(p.scalars).toEqual({})
    expect(p.experiences).toEqual([])
    expect(p.droppedFieldKeys).toEqual([])
  })
})

describe('buildCvProposalDiff', () => {
  it('marks a blank candidate field as "will fill" and a filled one as "will keep"', () => {
    const p = mapCvProposal(raw())
    const diff = buildCvProposalDiff(p, { first_name: 'Sanne', last_name: '', city: null })

    const byField = Object.fromEntries(diff.rows.map(r => [r.field, r]))
    expect(byField.first_name.willFill).toBe(false)
    expect(byField.first_name.current).toBe('Sanne')
    expect(byField.last_name.willFill).toBe(true)
    expect(byField.city.willFill).toBe(true)
    expect(diff.fillCount + diff.keepCount).toBe(diff.rows.length)
  })

  // The candidate contract renames this one field; reading `postcode` off the
  // candidate body would show a filled postcode as empty and promise a fill the
  // applier then skips.
  it('reads the candidate postcode from postal_code, not postcode', () => {
    const p = mapCvProposal(raw())
    const diff = buildCvProposalDiff(p, { postal_code: '8011 AA' })
    const row = diff.rows.find(r => r.field === 'postcode')

    expect(row?.current).toBe('8011 AA')
    expect(row?.willFill).toBe(false)
  })

  it('tolerates a numeric house number from the API (Laravel scalar serialisation)', () => {
    const p = mapCvProposal(raw())
    const diff = buildCvProposalDiff(p, { house_number: 12 })
    expect(diff.rows.find(r => r.field === 'house_number')?.current).toBe('12')
  })

  it('only produces rows for fields the CV actually proposed', () => {
    const p = mapCvProposal(raw({ fields: { first_name: 'Sanne' } }))
    const diff = buildCvProposalDiff(p, {})
    expect(diff.rows.map(r => r.field)).toEqual(['first_name'])
  })
})
