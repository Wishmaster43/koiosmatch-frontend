/**
 * facebookSdk — the ONE sanctioned third-party script (§7 documented
 * exception): Meta's JS SDK, required for Embedded Signup, loaded lazily and
 * only from the WhatsApp settings wizard once config.ready is true — never in
 * index.html. Separate module so the wizard hook can be tested against a
 * mocked seam instead of a real script injection.
 */

// Minimal surface of Meta's JS SDK — lib.dom carries none of this.
export interface FacebookSdk {
  init: (opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void
  login: (
    cb: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
    opts: Record<string, unknown>,
  ) => void
}
declare global {
  interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void }
}

// Coexistence variant of the flow (onboarding business app users). The token is
// a named constant so a rename after Danny's first live run is a one-line edit.
export const FEATURE_TYPE = 'whatsapp_business_app_onboarding'

// Load the SDK once per session (module-level promise — a second wizard mount
// must never inject a second script tag).
let sdkPromise: Promise<FacebookSdk> | null = null
// Injects Meta's SDK script exactly once per session (module-level promise, see the module doc above), resolving once fbAsyncInit fires or rejecting if window.FB never appears.
export function loadFacebookSdk(appId: string, version: string): Promise<FacebookSdk> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) { reject(new Error('sdk-init')); return }
      window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version })
      resolve(window.FB)
    }
    const script = document.createElement('script')
    // §7 documented exception: Meta's SDK is required for Embedded Signup and
    // only ever loads on this settings screen, gated on config.ready.
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => { sdkPromise = null; reject(new Error('sdk-load')) }
    document.body.appendChild(script)
  })
  return sdkPromise
}
