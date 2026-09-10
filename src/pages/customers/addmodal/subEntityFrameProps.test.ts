/**
 * subEntityFrameProps — pins the prop block the three customer sub-entity modals
 * share: title pair by mode, one import title on both import props, the footer
 * labels and the submit gate (DRY round 11, MODALS follow-up).
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { subEntityFrameProps } from './subEntityFrameProps'

const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key)) as unknown as TFunction

function build(isEdit: boolean, canSubmit = true) {
  return subEntityFrameProps({
    t, isEdit, editTitle: 'Edit', addTitle: 'Add', entityLabel: 'Contacts', persistKey: 'k',
    customerName: 'Acme', importOpen: false, setImportOpen: vi.fn(), alert: null, importCard: null,
    onClose: vi.fn(), submit: vi.fn(), canSubmit,
  })
}

describe('subEntityFrameProps', () => {
  it('uses the add title in create mode and the edit title in edit mode, on aria-label and title alike', () => {
    const add = build(false)
    expect(add.title).toBe('Add')
    expect(add.ariaLabel).toBe('Add')
    expect(add.submitLabel).toBe('subModal.create')
    const edit = build(true)
    expect(edit.title).toBe('Edit')
    expect(edit.ariaLabel).toBe('Edit')
    expect(edit.submitLabel).toBe('subModal.save')
  })

  it('interpolates the entity label into one import title used for button and card', () => {
    const p = build(false)
    expect(p.importButtonTitle).toBe('subModal.import.title:{"entity":"Contacts"}')
    expect(p.importCardTitle).toBe(p.importButtonTitle)
    expect(p.cancelLabel).toBe('subModal.cancel')
    expect(p.subtitle).toBe('Acme')
    expect(p.open).toBe(true)
  })

  it('disables submit exactly when the form cannot submit and wires cancel to onClose', () => {
    const p = build(false, false)
    expect(p.submitDisabled).toBe(true)
    expect(build(false, true).submitDisabled).toBe(false)
    expect(p.onCancel).toBe(p.onClose)
  })
})
