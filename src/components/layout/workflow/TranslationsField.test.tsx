/**
 * TranslationsField.test — the per-language message-override editor (02-09):
 * one block per configured language, writing config.translations, with the
 * clean-delete behaviour the CMBE3 contract expects (empty field -> key gone).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TranslationsField } from './TranslationsField'
import type { WorkflowField } from '@/types/workflow'
import { MESSAGING_LANGUAGES } from '@/modules/messagingLanguages'

// Key-echo t() — mirrors the sibling workflow-field test idiom (LogsPanel.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const subjectBodyField = { key: 'translations', fields: ['subject', 'body'], languages: MESSAGING_LANGUAGES } as unknown as WorkflowField
const textField = { key: 'translations', fields: ['text'], languages: MESSAGING_LANGUAGES } as unknown as WorkflowField

describe('TranslationsField', () => {
  it('renders one block per configured language', () => {
    render(<TranslationsField field={subjectBodyField} onChange={vi.fn()} />)
    for (const code of MESSAGING_LANGUAGES) {
      expect(screen.getByText(`translations.languages.${code}`)).toBeInTheDocument()
    }
  })

  it('renders a subject input and a body textarea per language when fields are [subject, body]', () => {
    render(<TranslationsField field={subjectBodyField} onChange={vi.fn()} />)
    expect(screen.getAllByLabelText(/translations\.languages\.en translations\.fields\.subject/).length).toBe(1)
    // ExpandableTextarea names itself via aria-label = fieldLabel(t, field.label); label is the raw sub-label here (no fieldLabels entry expected in this unit test).
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(MESSAGING_LANGUAGES.length) // 1 subject input (role textbox too) + 1 textarea per language
  })

  it('renders only a textarea per language when fields is [text]', () => {
    render(<TranslationsField field={textField} onChange={vi.fn()} />)
    // 7 languages x 1 textarea, no subject inputs
    expect(screen.queryAllByLabelText(/translations\.fields\.subject/).length).toBe(0)
  })

  it('typing into the EN subject calls onChange with only that key set', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={subjectBodyField} onChange={onChange} />)
    const enSubject = screen.getByLabelText('translations.languages.en translations.fields.subject')
    fireEvent.change(enSubject, { target: { value: 'Hi' } })
    expect(onChange).toHaveBeenCalledWith('translations', { en: { subject: 'Hi' } })
  })

  it('preserves an existing value for another language when editing a different one', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={subjectBodyField} value={{ nl: { body: 'x' } }} onChange={onChange} />)
    const enSubject = screen.getByLabelText('translations.languages.en translations.fields.subject')
    fireEvent.change(enSubject, { target: { value: 'Hi' } })
    expect(onChange).toHaveBeenCalledWith('translations', { nl: { body: 'x' }, en: { subject: 'Hi' } })
  })

  it('clearing the only key of a language removes that language from the map', () => {
    const onChange = vi.fn()
    render(<TranslationsField field={subjectBodyField} value={{ en: { subject: 'Hi' } }} onChange={onChange} />)
    const enSubject = screen.getByLabelText('translations.languages.en translations.fields.subject')
    fireEvent.change(enSubject, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('translations', {})
  })
})
