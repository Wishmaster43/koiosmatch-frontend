// Shared types for the email settings blocks.

// Coupling state for this context's OAuth provider (Gmail/Office 365).
export interface EmailConnStatus {
  connected?: boolean
  provider?: string
  address?: string
  // BE health check: connected | needs_reconnect | tenant_policy | disconnected (+ bureau-language message).
  status?: string
  status_reason?: string | null
  status_at?: string | null
  status_message?: string | null
}

// One test-send or OAuth-callback outcome banner.
export interface OutcomeBanner {
  ok: boolean
  msg: string
}
