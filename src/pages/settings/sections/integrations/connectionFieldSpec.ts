/**
 * connectionFieldSpec — the per-connector field layout for
 * IntegrationConnectionCard (SM-CREDS-2-FE). Moved out of the card so the spec
 * (data) and the render/save logic (behaviour) are testable separately.
 * Shiftmanager now carries TWO credential groups on one card (contract:
 * koiosmatch-api/docs/contract/CONTRACT-CHANGELOG.md, SM-CREDS-2): the tenant
 * API (subdomain + api_key, Bearer) and the open API (company + auth_token,
 * `company`/`authtoken` headers). Both groups always render: the BE sends
 * `has_auth_token` on every GET (SmCredentials.php:46-57), so the card has no
 * feature-detection flag; only `base_url` is value-gated, by the card itself.
 */
import type { ConnectorId } from './integrationsApi'

export interface FieldSpecEntry {
  key: 'two_way' | 'base_url' | 'api_key' | 'client_id' | 'client_secret' | 'environment' | 'subdomain' | 'company' | 'auth_token'
  kind: 'toggle' | 'text' | 'secret' | 'select'
  // Groups two or more fields under one titled GroupLabel (Shiftmanager's two
  // credential sets). Undefined = ungrouped, rendered as it always has been.
  group?: { id: 'token_api' | 'company_api'; titleKey: string; hintKey?: string }
}

// Per-connector field layout — the single source that drives which inputs render.
export const FIELD_SPEC: Record<ConnectorId, FieldSpecEntry[]> = {
  shiftmanager: [
    { key: 'two_way', kind: 'toggle' },
    // `base_url` is a super-admin override field: it only ever shows once the
    // loaded value is non-empty (checked by the caller), never as a blank
    // input on a fresh card — the tenant API's URL is derived from `subdomain`.
    { key: 'base_url', kind: 'text' },
    {
      key: 'subdomain', kind: 'text',
      group: { id: 'token_api', titleKey: 'integrations.connection.tokenApiTitle', hintKey: 'integrations.connection.tokenApiHint' },
    },
    { key: 'api_key', kind: 'secret', group: { id: 'token_api', titleKey: 'integrations.connection.tokenApiTitle' } },
    {
      key: 'company', kind: 'text',
      group: { id: 'company_api', titleKey: 'integrations.connection.companyApiTitle', hintKey: 'integrations.connection.companyApiHint' },
    },
    {
      key: 'auth_token', kind: 'secret',
      group: { id: 'company_api', titleKey: 'integrations.connection.companyApiTitle' },
    },
  ],
  // Question 119 (Danny 08-09, A): HelloFlex and Werkzoeken have no push-sync yet, so
  // their two_way switch stays hidden until one exists; Shiftmanager keeps it.
  helloflex: [
    { key: 'environment', kind: 'select' },
    { key: 'client_id', kind: 'text' },
    { key: 'client_secret', kind: 'secret' },
  ],
  werkzoeken: [
    { key: 'api_key', kind: 'secret' },
  ],
}
