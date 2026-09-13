/**
 * TextEditor · mono prop (13-09, Danny on FAQ/Knowledge: "Tekst is veel te groot").
 * `mono=false` (FAQ/Knowledge) renders the house field font at a modest starting
 * height; the default (`mono` unset, prompt/agent bodies) keeps the code-like
 * monospace 220px look unchanged.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TextEditor } from './shared'

describe('TextEditor · mono prop', () => {
  it('defaults to the monospace code-like look (prompt/agent bodies)', () => {
    const { container } = render(<TextEditor value="" onChange={() => {}} />)
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.style.fontFamily).toBe('monospace')
    expect(textarea.style.fontSize).toBe('12px')
    expect(textarea.style.height).toBe('220px')
  })

  it('mono={false} renders the house field font at a smaller starting height', () => {
    const { container } = render(<TextEditor value="" onChange={() => {}} mono={false} />)
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.style.fontFamily).not.toBe('monospace')
    expect(textarea.style.fontSize).toBe('13px')
    expect(textarea.style.height).toBe('140px')
  })

  it('an explicit height overrides the mono-based default either way', () => {
    const { container } = render(<TextEditor value="" onChange={() => {}} mono={false} height={90} />)
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.style.height).toBe('90px')
  })
})
