/**
 * TranslationsField.test — the per-language message-override editor (02-09
 * final design): a read-only company-language card, then only the languages
 * the user ADDED (nothing pre-rendered), each with a remove control, writing
 * config.translations with the clean-delete behaviour the CMBE3 contract
 * expects (empty field -> sub-key gone, language entry stays).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TranslationsField } from './TranslationsField'
import type { WorkflowField } from '@/types/workflow'
import { MESSAGING_LANGUAGES } from '@/modules/messagingLanguages'

// Key-echo t() + fixed UI locale — mirrors the sibling workflow-field test idiom
// (LogsPanel.test.tsx), with i18n.language read directly by languageDisplayName.
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'nl' } }),
}))

const textField = { key: 'translations', fields: ['text'], languages: MESSAGING_LANGUAGES, mainFields: { text: 'session_text' } } as unknown as WorkflowField
const emailField = { key: 'translations', fields: ['subject', 'body'], languages: MESSAGING_LANGUAGES, mainFields: { subject: 'subject', body: 'body' } } as unknown as WorkflowField

describe('TranslationsField', () => {
  it('with no rows: renders the company-language card with the main text, the empty hint and the add button', () => {
    render(<TranslationsField field={textField} config={{ session_text: 'Hoi {{firstname}}' }} onChange={vi.fn()} />)
    expect(screen.getByText('translations.companyLanguage')).toBeInTheDocument()
    expect(screen.getByText('Hoi {{firstname}}')).toBeInTheDocument()
    expect(screen.getByText('translations.empty')).toBeInTheDocument()
    expect(screen.getByText('translations.addLanguage')).toBeInTheDocument()
    // No default-language blocks are pre-rendered.
    expect(screen.queryByText('Nederlands')).not.toBeInTheDocument()
    expect(screen.queryByText('Engels')).not.toBeInTheDocument()
  })

  it('renders only the language present in the value, with a remove control', () => {
    render(<TranslationsField field={textField} value={{ pl: { text: 'Cześć' } }} onChange={vi.fn()} />)
    expect(screen.getByText('Pools')).toBeInTheDocument()
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.queryByText('Nederlands')).not.toBeInTheDocument()
    expect(screen.queryByText('Engels')).not.toBeInTheDocument()
    const textarea = screen.getByLabelText(/Pools/, { selector: 'textarea' })
    expect(textarea).toHaveValue('Cześć')
    expect(screen.getByRole('button', { name: /translations\.removeLanguage/ })).toBeInTheDocument()
  })

  it('adding: opens the picker with defaults first and Polish absent once already present, then adds the chosen code', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={textField} value={{ pl: { text: 'Cześć' } }} onChange={onChange} />)
    fireEvent.click(screen.getByText('translations.addLanguage'))
    fireEvent.click(screen.getByText('translations.pickLanguage'))
    // Assert on the FULL option list (not just a matched subset), so the
    // ordering proof can't pass under a pure alphabetical sort: 'Roemeens' is
    // a MESSAGING_LANGUAGES default and 'Arabisch' a curated extra, and 'Arabisch'
    // sorts alphabetically before 'Roemeens' — only the defaults-first branch
    // (TranslationsField.tsx) keeps Roemeens ahead of it.
    const allOptions = screen.getAllByText(/ \([A-Z]{2,3}\)$/)
    expect(allOptions[0].textContent).toBe('Nederlands (NL)')
    const roIndex = allOptions.findIndex(o => o.textContent === 'Roemeens (RO)')
    const arIndex = allOptions.findIndex(o => o.textContent === 'Arabisch (AR)')
    expect(roIndex).toBeGreaterThanOrEqual(0)
    expect(arIndex).toBeGreaterThanOrEqual(0)
    expect(roIndex).toBeLessThan(arIndex)
    expect(screen.queryByText(/^Pools \(PL\)$/)).not.toBeInTheDocument()
    const trOption = screen.getAllByText(/^Turks \(TR\)$/)[0]
    fireEvent.click(trOption)
    expect(onChange).toHaveBeenCalledWith('translations', { pl: { text: 'Cześć' }, tr: {} })
  })

  it('clicking the remove control drops that language entirely', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={textField} value={{ pl: { text: 'Cześć' } }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /translations\.removeLanguage/ }))
    expect(onChange).toHaveBeenCalledWith('translations', {})
  })

  it('emptying the only key of a language keeps that language as an empty entry', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={textField} value={{ pl: { text: 'Cześć' } }} onChange={onChange} />)
    const textarea = screen.getByLabelText(/Pools/, { selector: 'textarea' })
    fireEvent.change(textarea, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('translations', { pl: {} })
  })

  it('the textarea aria-label carries the language name', () => {
    render(<TranslationsField field={textField} value={{ pl: { text: 'Cześć' } }} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Pools/, { selector: 'textarea' })).toBeInTheDocument()
  })

  it('email-shaped field (subject/body) shows both main values on the company card', () => {
    render(<TranslationsField field={emailField} config={{ subject: 'Hallo', body: 'Welkom' }} onChange={vi.fn()} />)
    expect(screen.getByText('Hallo')).toBeInTheDocument()
    expect(screen.getByText('Welkom')).toBeInTheDocument()
  })

  it('renders the fallback hint text', () => {
    render(<TranslationsField field={textField} onChange={vi.fn()} />)
    expect(screen.getByText('translations.fallbackHint')).toBeInTheDocument()
  })
})
