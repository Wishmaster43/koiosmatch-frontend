import { describe, it, expect, beforeEach } from 'vitest'
import { AUTH_NOTICE_KEY, setAuthNotice, readAuthNotice, clearAuthNotice } from './authNotice'

describe('authNotice', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips a notice kind and clears it', () => {
    expect(readAuthNotice()).toBeNull()
    setAuthNotice('password_reset')
    expect(readAuthNotice()).toBe('password_reset')
    setAuthNotice('invite_accepted')
    expect(readAuthNotice()).toBe('invite_accepted')
    clearAuthNotice()
    expect(readAuthNotice()).toBeNull()
  })

  it('treats an unknown stored value as none', () => {
    sessionStorage.setItem(AUTH_NOTICE_KEY, 'something_else')
    expect(readAuthNotice()).toBeNull()
  })
})
