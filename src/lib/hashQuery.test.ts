import { describe, it, expect, afterEach } from 'vitest'
import { getHashParams, oauthReasonKey, stripOauthParams } from './hashQuery'

describe('hashQuery', () => {
  afterEach(() => { window.history.replaceState(null, '', '/') })

  it('reads params from the hash query, and returns none without one', () => {
    expect(getHashParams('#profile?email_oauth=error&reason=x').get('email_oauth')).toBe('error')
    expect(getHashParams('#profile').get('email_oauth')).toBeNull()
    expect(getHashParams('').toString()).toBe('')
  })

  it('maps the four BE reason codes and rejects unknown ones', () => {
    expect(oauthReasonKey('browser_mismatch')).toBe('BrowserMismatch')
    expect(oauthReasonKey('provider_denied')).toBe('ProviderDenied')
    expect(oauthReasonKey('token_exchange_failed')).toBe('TokenExchangeFailed')
    expect(oauthReasonKey('state_invalid')).toBe('StateInvalid')
    expect(oauthReasonKey('nope')).toBeNull()
    expect(oauthReasonKey(null)).toBeNull()
  })

  it('strips only the OAuth params and keeps the page and other params', () => {
    window.history.replaceState(null, '', '/#profile?email_oauth=connected&context=personal&email=a%40b.nl&request_id=1&reason=x&keep=1')
    stripOauthParams()
    expect(window.location.hash).toBe('#profile?keep=1')
  })
})
