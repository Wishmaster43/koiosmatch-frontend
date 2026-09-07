/**
 * mfaApi — two MFA-related API calls: regenerate recovery codes and
 * reset a colleague's MFA enrollment.
 */
import api from '@/lib/api'
import type { operations } from '@/types/api-generated'

// Hand-written response shape — the backend returns { recovery_codes: string[] }
// but the generated schema does not document the success response yet.
interface RegenerateRecoveryCodesResponse {
  recovery_codes: string[]
}

// Regenerate the current user's recovery codes after entering a valid TOTP code.
export async function regenerateRecoveryCodes(code: string): Promise<RegenerateRecoveryCodesResponse> {
  const body: operations['postAuthMfaRecoveryCodes']['requestBody']['content']['application/json'] = { code }
  const { data } = await api.post('/auth/mfa/recovery-codes', body)
  return data
}

// Reset a colleague's MFA enrollment; they re-enroll at next login. Requires permission users.mfa_reset.
export async function resetUserMfa(userId: string | number): Promise<void> {
  await api.post(`/users/${userId}/mfa/reset`)
}
