import { describe, it, expect } from 'vitest'
import { pickListPaging, pickListRange } from './listRange'

describe('pickListRange', () => {
  it('returns nulls without data or without meta', () => {
    expect(pickListRange(undefined)).toEqual({ rangeFrom: null, rangeTo: null })
    expect(pickListRange({})).toEqual({ rangeFrom: null, rangeTo: null })
  })
  it('passes the server range through', () => {
    expect(pickListRange({ rangeFrom: 101, rangeTo: 104 })).toEqual({ rangeFrom: 101, rangeTo: 104 })
  })
})

describe('pickListPaging', () => {
  it('defaults to zero rows on one page without data', () => {
    expect(pickListPaging(undefined)).toEqual({ total: 0, lastPage: 1 })
  })
  it('passes total and last page through', () => {
    expect(pickListPaging({ total: 204, lastPage: 3 })).toEqual({ total: 204, lastPage: 3 })
  })
})
