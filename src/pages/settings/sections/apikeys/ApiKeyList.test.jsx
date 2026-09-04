/**
 * ApiKeyList — K-282: the primary key reads a visible "Primair" SoftChip in the
 * type column; an additional key stays calm (its existing plain-text label, no
 * chip). Asserts the DOM shape (SPAN chip vs. bare TD text), not just the label,
 * so the chip branch can never silently regress back to plain text.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import i18n from '@/i18n'
import ApiKeyList from './ApiKeyList'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => cleanup())

const key = (over = {}) => ({
  id: 'k1', friendly_name: 'Backoffice key', status: 'active', organisation: 'Yesway',
  type: 'additional', guid: 'abcd1234-5678-90ab-cdef-1234567890ab',
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', ...over,
})

const noop = { onReload: vi.fn(), onOpen: vi.fn(), onNew: vi.fn() }

describe('ApiKeyList — K-282 primary chip', () => {
  it('renders a SoftChip for the primary key, not a plain text cell', () => {
    render(<ApiKeyList keys={[key({ id: 'k1', type: 'primary' })]} loading={false} error={false} {...noop} />)

    const label = screen.getByText(st('apiKeys.type.primary'))
    // SoftChip renders its label inside its own tinted <span>; a plain-text cell
    // would put the same text directly in the <td>.
    expect(label.tagName).toBe('SPAN')
  })

  it('renders the additional key as plain text — no chip, calm by default', () => {
    render(<ApiKeyList keys={[key({ id: 'k2', type: 'additional' })]} loading={false} error={false} {...noop} />)

    const label = screen.getByText(st('apiKeys.type.additional'))
    expect(label.tagName).toBe('TD')
  })

  it('mixed list: only the primary row gets the chip', () => {
    render(<ApiKeyList
      keys={[key({ id: 'k1', type: 'primary' }), key({ id: 'k2', type: 'additional', friendly_name: 'Second key' })]}
      loading={false} error={false} {...noop}
    />)

    expect(screen.getByText(st('apiKeys.type.primary')).tagName).toBe('SPAN')
    expect(screen.getByText(st('apiKeys.type.additional')).tagName).toBe('TD')
  })
})
