/**
 * E-mail connection contexts. The canonical English name is the settings-key infix
 * (email_<context>_*), the BE route segment, the test-mail body value and the OAuth
 * callback token alike (SETTINGS-ALIAS-RETIRE-1, BE ce191ec61): no wire map remains.
 */
export type EmailContext = 'customers' | 'candidates' | 'planning'

// The contexts that have their own e-mail connection tab.
export const EMAIL_CONTEXTS: readonly EmailContext[] = ['customers', 'candidates', 'planning']
