/** Maps the BE health/test reason codes (koiosmatch-api lang/en/integrations.php) onto the bare FE key family integrations.reason.*. */

// Strips the connector prefix (sm_/wz_/hf_) and folds invalid_config_<connector> into invalid_config.
export function normalizeReasonCode(code: string | null | undefined): string | null {
  if (!code) return null
  if (/^invalid_config_(hf|wz|sm)$/.test(code)) return 'invalid_config'
  return code.replace(/^(sm|wz|hf)_/, '')
}
