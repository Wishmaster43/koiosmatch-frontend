import { describe, it, expect } from 'vitest'
import { mapAddressPatch } from './mapAddressPatch'

describe('mapAddressPatch', () => {
  it('maps address UI fields to API snake_case keys', () => {
    const patch = {
      street: 'Main St',
      houseNumber: '123',
      houseNumberSuffix: 'A',
      addressLine2: 'Suite 100',
      postalCode: '12345',
      city: 'Amsterdam',
      province: 'North Holland',
      country: 'NL',
    }
    const body: Record<string, unknown> = {}

    mapAddressPatch(patch, body)

    expect(body).toEqual({
      street: 'Main St',
      house_number: '123',
      house_number_suffix: 'A',
      address_line_2: 'Suite 100',
      postcode: '12345',
      city: 'Amsterdam',
      province: 'North Holland',
      country: 'NL',
    })
  })

  it('clears country on empty string when clearCountryOnEmpty is true', () => {
    const patch = { country: '' }
    const body: Record<string, unknown> = {}

    mapAddressPatch(patch, body, { clearCountryOnEmpty: true })

    expect(body.country).toBeNull()
  })

  it('preserves country empty string when clearCountryOnEmpty is false', () => {
    const patch = { country: '' }
    const body: Record<string, unknown> = {}

    mapAddressPatch(patch, body, { clearCountryOnEmpty: false })

    expect(body.country).toBe('')
  })

  it('only maps fields present in the patch', () => {
    const patch = { street: 'Main St', city: 'Amsterdam' }
    const body: Record<string, unknown> = {}

    mapAddressPatch(patch, body)

    expect(Object.keys(body)).toEqual(['street', 'city'])
    expect(body).toEqual({ street: 'Main St', city: 'Amsterdam' })
  })
})
