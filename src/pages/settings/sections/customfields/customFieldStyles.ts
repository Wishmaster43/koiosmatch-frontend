// Card/label/input faces for the custom-fields editor (moved verbatim from CustomFieldsSettings).
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { tableHeadStyle } from '@/components/ui/typography'

export const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8,
}
// Canon field style (G33/fieldMetrics) — was its own padding-6/radius-6 copy.
export const inputStyle = fieldInputStyle
export const labelStyle = { ...tableHeadStyle, display: 'block', marginBottom: 4 } as const
