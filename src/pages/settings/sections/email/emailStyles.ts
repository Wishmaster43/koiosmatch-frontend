// Shared card/label/input faces for the email settings blocks (moved verbatim from EmailSettings).
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

// Canon field style (G33/fieldMetrics) — was its own height-34 copy, minus a background.
export const inputStyle = fieldInputStyle
export const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 4, display: 'block' } as const
// Shared card chrome — matches the settings kit's SettingCard so this section
// reads at the same compact density as every other settings panel.
export const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }
