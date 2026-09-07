/**
 * FunctionMatrixField (shift_score's functie_matrix, type 'function_matrix') —
 * proves the round-trip persists the EXACT nested shape the engine reads
 * (ShiftScoreModule.php lines 51–57: `functieMatrix[position]` as
 * { primary: string[], secondary: string[] }).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { FunctionMatrixField } from './FunctionMatrixField'

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'nl',
      fallbackLng: 'en',
      resources: {
        nl: {
          workflows: {
            fields: {
              functionPosition: 'Functienaam',
              functionPrimary: 'Primaire functies',
              functionSecondary: 'Secundaire functies',
              add: 'Toevoegen',
              duplicateKey: 'Deze sleutel bestaat al in de lijst.'
            }
          },
          common: {
            remove: 'Verwijderen'
          }
        },
        en: {
          workflows: {
            fields: {
              functionPosition: 'Function name',
              functionPrimary: 'Primary functions',
              functionSecondary: 'Secondary functions',
              add: 'Add',
              duplicateKey: 'This key already exists in the list.'
            }
          },
          common: {
            remove: 'Remove'
          }
        }
      }
    })
  }
})

describe('FunctionMatrixField', () => {
  it('round-trips a pre-filled matrix without reshaping it', () => {
    const value = {
      'verpleegkundige niveau 5': {
        primary: ['verpleegkundige', 'verpleegster'],
        secondary: ['verzorgende ig', 'evv']
      },
      'bouwvakker': {
        primary: ['schilder'],
        secondary: ['elektricien']
      }
    }
    render(<FunctionMatrixField value={value} onChange={() => {}} fieldKey="functie_matrix" />)

    // Existing rows render back as-is (comma-joined format).
    expect(screen.getByDisplayValue('verpleegkundige niveau 5')).toBeTruthy()
    expect(screen.getByDisplayValue('verpleegkundige, verpleegster')).toBeTruthy()
    expect(screen.getByDisplayValue('verzorgende ig, evv')).toBeTruthy()
    expect(screen.getByDisplayValue('bouwvakker')).toBeTruthy()
    expect(screen.getByDisplayValue('schilder')).toBeTruthy()
    expect(screen.getByDisplayValue('elektricien')).toBeTruthy()
  })

  it('removes a row via the delete button', () => {
    let last: unknown
    const onChange = (_key: string, value: unknown) => { last = value }
    const initial = {
      'verpleegkundige': { primary: ['verpleegkundige'], secondary: ['verzorgende'] },
      'arts': { primary: ['arts'], secondary: ['tandarts'] }
    }
    render(<FunctionMatrixField value={initial} onChange={onChange} fieldKey="functie_matrix" />)

    // Click the first row's remove button (the last button in each row).
    const removeButtons = screen.getAllByRole('button', { name: /remove|verwijderen/i })
    fireEvent.click(removeButtons[0])

    // The persisted value should now only have the 'arts' entry.
    expect(last).toEqual({
      'arts': { primary: ['arts'], secondary: ['tandarts'] }
    })
  })

  it('parses comma-separated input: split, trim, lowercase, drop empties', () => {
    // This test verifies the parsing logic by starting with an existing row,
    // editing its primary functions, and checking the result.
    let last: unknown
    const onChange = (_key: string, value: unknown) => { last = value }
    const initial = {
      'functie1': { primary: ['primary1'], secondary: ['sec1'] }
    }
    render(<FunctionMatrixField value={initial} onChange={onChange} fieldKey="functie_matrix" />)

    // Edit the primary functions input.
    const inputs = screen.getAllByRole('textbox')
    const primaryInput = inputs[1] // second input per row (position, primary, secondary)
    fireEvent.change(primaryInput, { target: { value: '  Primary A  ,  Primary B  , ' } })

    // The component should call onChange with parsed values: trimmed, lowercased, empties dropped.
    expect(last).toEqual({
      'functie1': { primary: ['primary a', 'primary b'], secondary: ['sec1'] }
    })
  })

  it('commits a new row on Enter once the position is filled, persisting the nested shape', () => {
    let last: unknown
    const onChange = (_key: string, value: unknown) => { last = value }
    render(<FunctionMatrixField value={{}} onChange={onChange} fieldKey="functie_matrix" />)

    // "+ add" opens one pending draft row.
    fireEvent.click(screen.getByRole('button', { name: /toevoegen|add/i }))
    const [position, primary, secondary] = screen.getAllByRole('textbox')
    fireEvent.change(position, { target: { value: ' Verpleegkundige niveau 5 ' } })
    fireEvent.change(primary, { target: { value: 'Verpleegkundige' } })
    fireEvent.change(secondary, { target: { value: 'verzorgende ig, evv' } })
    // Nothing persists while the row is still a draft.
    expect(last).toBeUndefined()

    fireEvent.keyDown(secondary, { key: 'Enter' })
    expect(last).toEqual({
      'verpleegkundige niveau 5': { primary: ['verpleegkundige'], secondary: ['verzorgende ig', 'evv'] },
    })
  })
})
