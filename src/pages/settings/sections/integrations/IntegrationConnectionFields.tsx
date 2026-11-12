/**
 * IntegrationConnectionFields: the field list of the connection card (text, select,
 * toggle and write-only secret inputs), driven by the per-connector FIELD_SPEC.
 * Extracted render-identical from IntegrationConnectionCard (size split).
 */
import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import SelectMenu from '@/components/ui/SelectMenu'
import FieldNotice from '@/components/ui/FieldNotice'
import { Caption, BodyText, GroupLabel, captionStyle } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { FieldSpecEntry } from './connectionFieldSpec'

// A field's own dirty/value state for a secret: `undefined` = untouched (omit
// from the PUT body), a string = typed a new value, `null` = explicitly cleared.
export type SecretState = string | null | undefined

// A working copy of ANY connector's settings, loosely typed on purpose: the
// FIELD_SPEC below is the single source of truth for which keys actually apply
// to the current connector, so the component reads/writes through it rather
// than re-deriving connector-specific narrowing everywhere.
export interface WorkingSettings {
  two_way: boolean
  subdomain?: string | null
  base_url?: string | null
  client_id?: string | null
  environment?: 'uat' | 'live'
  has_api_key?: boolean
  has_client_secret?: boolean
  company?: string | null
  has_auth_token?: boolean
  connected_as: string | null
}

// Field-label identity from the typography atom (stijlfabriek clause) — layout only here.
const labelStyle = { ...captionStyle, marginBottom: 4, display: 'block' as const }

// The single secret-field UI (state line + password input + clear ghost button),
// shared by every connector's api_key/client_secret row.
function SecretField({ fieldKey, hasSecret, value, onChange, t }: {
  fieldKey: 'api_key' | 'client_id' | 'client_secret' | 'auth_token'
  hasSecret: boolean
  value: SecretState
  onChange: (v: SecretState) => void
  t: (k: string) => string
}) {
  const labelKey = fieldKey === 'client_secret' ? 'clientSecret' : fieldKey === 'auth_token' ? 'authToken' : 'apiKey'
  const inputId = `integration-secret-${fieldKey}`
  return (
    <div>
      <label htmlFor={inputId} style={labelStyle}>{t(`integrations.connection.${labelKey}`)}</label>
      {/* Pending clear is a visible, undoable intent — not a silent state flip. */}
      {value === null ? (
        <Caption style={{ color: 'var(--color-danger-text)' }}>{t('integrations.connection.secretPendingClear')}</Caption>
      ) : (
        <Caption>{hasSecret ? t('integrations.connection.secretSet') : t('integrations.connection.secretNotSet')}</Caption>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input id={inputId} type="password" autoComplete="new-password"
          value={value === null ? '' : (value ?? '')}
          placeholder={t('integrations.connection.secretPlaceholder')}
          onChange={(e) => onChange(e.target.value)}
          style={fieldInputStyle} />
        {value === null ? (
          <Button variant="ghost" onClick={() => onChange(undefined)}>{t('integrations.connection.undoClear')}</Button>
        ) : hasSecret ? (
          <Button variant="ghost" onClick={() => onChange(null)}>{t('integrations.connection.clearSecret')}</Button>
        ) : null}
      </div>
    </div>
  )
}

// Renders the visible field list, inserting a GroupLabel + optional hint once
// before a group's first field — but ONLY once SM-CREDS-2 has landed
// (`hasGroups`); before that, a grouped field (api_key today) renders plain,
// exactly as it always has, so the old-shape face never shifts by a pixel.
function renderFieldsWithGroups(
  fields: FieldSpecEntry[],
  hasGroups: boolean,
  t: (k: string) => string,
  renderField: (f: FieldSpecEntry) => ReactNode,
) {
  let lastGroupId: string | undefined
  const nodes: ReactNode[] = []
  fields.forEach((field) => {
    const groupId = hasGroups ? field.group?.id : undefined
    if (groupId && groupId !== lastGroupId) {
      nodes.push(
        <div key={`group-${groupId}`} style={{ marginTop: lastGroupId ? 4 : 0 }}>
          <GroupLabel style={{ marginBottom: 4 }}>{t(field.group!.titleKey)}</GroupLabel>
          {field.group!.hintKey && <Caption as="p" style={{ marginTop: -2, marginBottom: 6 }}>{t(field.group!.hintKey)}</Caption>}
        </div>,
      )
    }
    lastGroupId = groupId
    nodes.push(renderField(field))
  })
  return nodes
}

// The whole field list for the visible spec; the card owns the state, this only renders.
export default function IntegrationConnectionFields({ visibleSpec, hasGroups, settings, secrets, setField, setSecret, clientIdInvalid, t }: {
  visibleSpec: FieldSpecEntry[]
  hasGroups: boolean
  settings: WorkingSettings
  secrets: Record<string, SecretState>
  setField: (patch: Partial<WorkingSettings>) => void
  setSecret: (key: string, v: SecretState) => void
  clientIdInvalid: boolean
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  return <>{renderFieldsWithGroups(visibleSpec, hasGroups, t, (field) => {
          if (field.kind === 'toggle') {
            return (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle checked={!!settings.two_way} onChange={(v) => setField({ two_way: v })} ariaLabel={t('integrations.connection.twoWay')} />
                <div>
                  <BodyText>{t('integrations.connection.twoWay')}</BodyText>
                  <Caption>{t('integrations.connection.twoWayHint')}</Caption>
                </div>
              </div>
            )
          }
          if (field.kind === 'text') {
            const labelKey = field.key === 'base_url' ? 'baseUrl'
              : field.key === 'subdomain' ? 'subdomain'
                : field.key === 'company' ? 'company' : 'clientId'
            const val = (settings as unknown as Record<string, unknown>)[field.key]
            return (
              <div key={field.key}>
                <label htmlFor={`integration-${field.key}`} style={labelStyle}>{t(`integrations.connection.${labelKey}`)}</label>
                <input id={`integration-${field.key}`} aria-invalid={field.key === 'client_id' && clientIdInvalid ? true : undefined} value={typeof val === 'string' ? val : ''}
                  onChange={(e) => setField({ [field.key]: e.target.value } as Partial<WorkingSettings>)}
                  style={fieldInputStyle} />
                {field.key === 'client_id' && clientIdInvalid && (
                  <FieldNotice text={t('integrations.connection.clientIdInvalid')} />
                )}
                {field.key === 'subdomain' && (
                  <Caption as="p" style={{ marginTop: 4 }}>{t('integrations.connection.subdomainHint')}</Caption>
                )}
              </div>
            )
          }
          if (field.kind === 'select') {
            // Only `environment` is a select field today (helloflex uat/live).
            return (
              <div key={field.key}>
                <label id="integration-environment-label" style={labelStyle}>{t('integrations.connection.environment')}</label>
                <SelectMenu
                  aria-labelledby="integration-environment-label"
                  value={settings.environment ?? 'uat'}
                  onChange={(v) => setField({ environment: v as 'uat' | 'live' })}
                  options={[
                    { value: 'uat', label: t('integrations.connection.envUat') },
                    { value: 'live', label: t('integrations.connection.envLive') },
                  ]}
                />
              </div>
            )
          }
          // Secret field (api_key / client_secret / auth_token).
          const hasKey = field.key === 'client_secret' ? 'has_client_secret'
            : field.key === 'auth_token' ? 'has_auth_token' : 'has_api_key'
          return (
            <SecretField key={field.key}
              fieldKey={field.key as 'api_key' | 'client_secret' | 'auth_token'}
              hasSecret={!!(settings as unknown as Record<string, unknown>)[hasKey]}
              value={secrets[field.key]}
              onChange={(v) => setSecret(field.key, v)}
              t={t} />
          )
        })}</>
}
