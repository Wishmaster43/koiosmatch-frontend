// The plain config-panel text INPUT's shared style (§4) — split into its own
// module (not fields.tsx) so importing it never trips react-refresh's
// component-only-exports rule on a file that also exports React components.
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the config-panel text INPUT's own size/colour (SettingsSearch precedent), not a BodyText paragraph render
export const PANEL_INPUT_STYLE = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' } as const
