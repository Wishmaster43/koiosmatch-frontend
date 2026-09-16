/**
 * MapColumnsStep — behaviour under test: DROPDOWN-CLEAR-1. Clearing the target-field
 * picker (the shared clear cross on CreatableSelect) must land the mapping on SKIP
 * (the picker's own honest empty state, "will be skipped"), never on '' — a bare ''
 * neither renders a real column nor triggers the skipped notice, and silently drops
 * the row's data on upload (mapping.ts buildMappedRows keys on SKIP, not '').
 *
 * `react-i18next` is mocked to the identity function so the test does not depend on
 * real locale copy (mirrors MergeCustomerModal.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapColumnsStep from './MapColumnsStep'
import { SKIP } from '../lib/mapping'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

function mount(onChangeMapping = vi.fn()) {
  render(
    <MapColumnsStep
      entity="candidates"
      headers={['Voornaam']}
      targetColumns={['first_name', 'last_name']}
      mapping={{ Voornaam: 'first_name' }}
      onChangeMapping={onChangeMapping}
      onNext={vi.fn()}
      onBack={vi.fn()}
    />
  )
  return onChangeMapping
}

describe('MapColumnsStep', () => {
  // Clearing the picker (the shared X) must resolve to SKIP, not '', so the row
  // keeps its honest "will be skipped" state instead of silently vanishing.
  it('maps the clear action to SKIP, never a bare empty string', () => {
    const onChangeMapping = mount()
    const clearButton = screen.getByRole('button', { name: /clear|wis/i })
    fireEvent.click(clearButton)
    expect(onChangeMapping).toHaveBeenCalledWith('Voornaam', SKIP)
    expect(onChangeMapping).not.toHaveBeenCalledWith('Voornaam', '')
  })

  // A column mapped to SKIP shows the skipped notice, proving the mapping actually
  // reached the honest empty state rather than a dropped '' target.
  it('shows the skipped notice once a column maps to SKIP', () => {
    render(
      <MapColumnsStep
        entity="candidates"
        headers={['Onbekend']}
        targetColumns={['first_name']}
        mapping={{ Onbekend: SKIP }}
        onChangeMapping={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('import.wizard.mapping.skippedNotice')).toBeTruthy()
  })
})
