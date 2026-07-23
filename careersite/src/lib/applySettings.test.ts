import { describe, it, expect } from 'vitest'
import { getApplicationSettings } from './applySettings'

describe('getApplicationSettings', () => {
  it('fills the documented defaults when application_settings is missing entirely', () => {
    expect(getApplicationSettings({})).toEqual({
      cv: 'optional',
      cover_letter: 'optional',
      photo: 'hidden',
      remarks: 'optional',
      interview_consent: 'optional',
    })
  })

  it('fills only the missing keys, keeping the ones the backend did send', () => {
    expect(getApplicationSettings({ application_settings: { cv: 'required', photo: 'optional' } })).toEqual({
      cv: 'required',
      cover_letter: 'optional',
      photo: 'optional',
      remarks: 'optional',
      interview_consent: 'optional',
    })
  })
})
