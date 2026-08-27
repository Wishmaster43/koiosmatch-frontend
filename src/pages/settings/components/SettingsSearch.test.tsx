import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import SettingsSearch from './SettingsSearch'
import settingsNl from '@/i18n/locales/nl/settings.json'
import settingsSearchNl from '@/i18n/locales/nl/settingsSearch.json'

// Real Dutch resources — the bug was locale-specific ("E-mail" vs. "email"), so a
// stubbed translation would prove nothing about the seam that actually broke.
function renderPalette(onSelect = vi.fn()) {
  const i18n = createInstance()
  i18n.use(initReactI18next).init({
    lng: 'nl',
    resources: { nl: { settings: settingsNl, settingsSearch: settingsSearchNl } },
    ns: ['settings', 'settingsSearch'],
    defaultNS: 'settings',
    interpolation: { escapeValue: false },
  })

  // Two real registry groups: the e-mail tabs plus one unrelated group, so a hit
  // has to be a genuine match and not "everything is shown anyway".
  const groups = [
    {
      key: 'communication',
      items: [
        { id: 'email_customers' },
        { id: 'email_candidates' },
        { id: 'email_planning' },
        { id: 'email_log' },
      ],
    },
    { key: 'candidate', items: [{ id: 'candidate_display' }, { id: 'pools' }] },
  ]

  render(
    <I18nextProvider i18n={i18n}>
      <SettingsSearch open onClose={vi.fn()} groups={groups} onSelect={onSelect} />
    </I18nextProvider>,
  )
  return { input: screen.getByPlaceholderText(settingsNl.shell.search), onSelect }
}

describe('SettingsSearch', () => {
  it('finds the e-mail settings when typing "email" (regression: Dutch labels spell it "E-mail")', () => {
    const { input } = renderPalette()
    fireEvent.change(input, { target: { value: 'email' } })

    expect(screen.getByRole('option', { name: /E-mail klanten/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /E-mail-log/ })).toBeInTheDocument()
    expect(screen.queryByText(settingsNl.shell.noResults)).not.toBeInTheDocument()
  })

  it('treats hyphen, casing and diacritics as the same word', () => {
    const { input } = renderPalette()

    // Hyphenated spelling — the label's own form.
    fireEvent.change(input, { target: { value: 'e-mail' } })
    expect(screen.getByRole('option', { name: /E-mail klanten/ })).toBeInTheDocument()

    // Upper case + an accent the label does not carry: normalisation folds both.
    fireEvent.change(input, { target: { value: 'É-MAÍL' } })
    expect(screen.getByRole('option', { name: /E-mail klanten/ })).toBeInTheDocument()
  })

  it('matches a recruiter synonym that appears in no label ("bericht")', () => {
    const { input } = renderPalette()
    fireEvent.change(input, { target: { value: 'bericht' } })

    expect(screen.getByRole('option', { name: /E-mail klanten/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /pool/i })).not.toBeInTheDocument()
  })

  it('picks the highlighted result with arrow keys and Enter', () => {
    const { input, onSelect } = renderPalette()
    fireEvent.change(input, { target: { value: 'email' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toBe('communication')
  })

  it('stays honest when nothing matches', () => {
    const { input } = renderPalette()
    fireEvent.change(input, { target: { value: 'qqqzzz' } })

    expect(screen.getByText(settingsNl.shell.noResults)).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
