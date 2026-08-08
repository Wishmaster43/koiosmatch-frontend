/**
 * IdentifierValidationSettings — Settings → Klanten → Nummervalidatie
 * (KVK/BTW-PER-LAND-1, Danny 2026-08-08 points 10 + 11: "KVK nummer check is 8
 * cijfers --> Check per land want BE, DE, FR is anders" and "BTW nummer voor NL
 * begint met NL, moeten check instellen per klant --> Instellingen").
 *
 * ONE tenant switch: does a number that does not match its country's format
 * BLOCK the save, or only WARN? The rules themselves are not tenant data — they
 * are the real-world formats in `lib/companyIdentifiers` — so this screen shows
 * them read-only, which is also what makes the setting understandable.
 *
 * Persistence goes through the generic key/value store (`POST /settings`,
 * verified live 2026-08-08 for a brand-new key: it round-trips through
 * `GET /settings` unchanged), the same path every other tenant flag on this
 * screen family uses. There is no dedicated endpoint and none is needed.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingRow, SelectField } from '@/pages/settings/components/SettingsKit'
import { useAllSettings, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { getCountryName } from '@/lib/countries'
import {
  IDENTIFIER_VALIDATION_SETTING, SUPPORTED_IDENTIFIER_COUNTRIES,
  identifierExample, parseIdentifierValidationMode,
} from '@/lib/companyIdentifiers'

// Read-only rules table cell — mono for the format examples (§4: numbers/IDs).
const cell: CSSProperties = { padding: '6px 10px', fontSize: 12, color: 'var(--text)', textAlign: 'left' }
const headCell: CSSProperties = { ...cell, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const monoCell: CSSProperties = { ...cell, fontFamily: 'JetBrains Mono, monospace' }

export default function IdentifierValidationSettings() {
  const { t, i18n } = useTranslation('settings')
  const settings = useAllSettings()
  const mode = parseIdentifierValidationMode(settings[IDENTIFIER_VALIDATION_SETTING])

  // Persist immediately (this is a single switch, not a form) — a failed save must
  // never be silent, so the toast carries the shared generic failure message.
  const setMode = (next: string) => {
    saveSettingsKeys({ [IDENTIFIER_VALIDATION_SETTING]: next }).catch(() => notifyError(t('common:actionFailed')))
  }

  const options = [
    { value: 'warn', label: t('identifierValidation.modeWarn') },
    { value: 'block', label: t('identifierValidation.modeBlock') },
  ]

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('identifierValidation.title')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t('identifierValidation.subtitle')}</p>

      {/* The one tenant decision on this screen — searchable picker (§4), never a native select. */}
      <SettingRow label={t('identifierValidation.modeLabel')} description={t('identifierValidation.modeHint')}>
        <div style={{ width: 220 }}>
          <SelectField value={mode} options={options} onChange={setMode} ariaLabel={t('identifierValidation.modeLabel')} />
        </div>
      </SettingRow>

      {/* Read-only reference: which format is expected per country. Country names come
          from Intl (no extra translation keys); examples are real-world data. */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('identifierValidation.rulesTitle')}
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {t('identifierValidation.rulesTitle')}
            </caption>
            <thead>
              <tr>
                <th scope="col" style={headCell}>{t('identifierValidation.colCountry')}</th>
                <th scope="col" style={headCell}>{t('identifierValidation.colCoc')}</th>
                <th scope="col" style={headCell}>{t('identifierValidation.colVat')}</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_IDENTIFIER_COUNTRIES.map(code => (
                <tr key={code} style={{ borderTop: '1px solid var(--border)' }}>
                  <th scope="row" style={{ ...cell, fontWeight: 500 }}>{getCountryName(code, i18n.language)}</th>
                  <td style={monoCell}>{identifierExample('coc', code)}</td>
                  <td style={monoCell}>{identifierExample('vat', code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('identifierValidation.unknownCountryHint')}</p>
      </div>
    </div>
  )
}
