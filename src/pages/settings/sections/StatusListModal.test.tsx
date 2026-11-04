/**
 * StatusListModal — the extraField picker offers a clear control only when the field is
 * nullable (DROPDOWN-CLEAR-1): a required extra field persists directly and may not be emptied.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import StatusListModal from './StatusListModal'
import type { ExtraFieldDef } from './statusListEditorTypes'

const ct = (key: string) => i18n.t(key, { ns: 'common' })
const options = [{ value: 'euro', label: 'Euro' }, { value: 'hour', label: 'Hour' }]

// Minimal harness: a draft carrying the extra field's value, no other optional sections.
function renderModal(extraField: ExtraFieldDef, value: string | null, setDraft = vi.fn()) {
  render(<StatusListModal editing={null} addLabel="Add" draft={{ name: 'x', color: 'var(--color-primary)', [extraField.key]: value }}
    setDraft={setDraft} withColor={false} resolvedIconPicker={null} numberField={null} extraField={extraField}
    flagList={[]} saving={false} onClose={vi.fn()} onSubmit={vi.fn()} />)
  return setDraft
}

describe('StatusListModal extraField picker', () => {
  it('renders a required extra field without a clear button', () => {
    renderModal({ key: 'unit', label: 'Unit', options, default: 'euro' }, 'euro')
    expect(screen.queryByRole('button', { name: ct('clear') })).not.toBeInTheDocument()
  })

  it('offers a working clear on a nullable extra field', async () => {
    const setDraft = renderModal({ key: 'country_code', label: 'Country', options, default: null }, 'euro')
    await userEvent.setup().click(screen.getByRole('button', { name: ct('clear') }))
    const updater = setDraft.mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>
    expect(updater({ name: 'x', country_code: 'euro' }).country_code).toBeNull()
  })
})
