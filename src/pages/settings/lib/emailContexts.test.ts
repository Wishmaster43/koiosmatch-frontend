import { describe, it, expect } from 'vitest'
import { EMAIL_CONTEXTS } from './emailContexts'

describe('emailContexts', () => {
  it('lists exactly the three canonical contexts', () => {
    expect([...EMAIL_CONTEXTS]).toEqual(['customers', 'candidates', 'planning'])
  })
})
