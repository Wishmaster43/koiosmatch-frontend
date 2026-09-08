import { tintBorder } from '@/lib/tint'

// Server-side rejection alert (non-field 422 / other failure) shown in place while the
// create modal stays open — DRY-1 O5: the same box was copied in AddContactPersonModal,
// AddDepartmentModal, AddLocationModal and AddCustomerModal (inset 24 there).
// Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its own
// pastel, an AA fail (Opus r3.5).
export default function CreateErrorAlert({
  message,
  inset = 22,
}: {
  message: string
  inset?: number
}) {
  return (
    <div
      role="alert"
      style={{
        margin: `0 ${inset}px 8px`,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 8,
        color: 'var(--color-on-danger-bg)',
        background: 'var(--color-danger-bg)',
        border: tintBorder('var(--color-danger)', true),
        flexShrink: 0,
      }}
    >
      {message}
    </div>
  )
}
