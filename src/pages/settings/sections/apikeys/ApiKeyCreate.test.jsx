/**
 * ApiKeyCreate — creating an API key with scopes must POST /api-keys with the
 * correct body including the scopes map and all form fields. Scopes for the five
 * candidate dossier entities (notes, documents, conversations, educations,
 * references) must be sendable just like any other scope.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ApiKeyCreate from './ApiKeyCreate'

// Keep the real unwrap/unwrapList — only api.post is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  // SCOPE-LEVEL-READONLY-1: the create view also reads the level hint; a 404 = no hint.
  return { ...actual, default: { get: vi.fn().mockRejectedValue({ response: { status: 404 } }), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks() })
// restoreAllMocks drops the factory's GET implementation; re-arm the level-hint 404 per test.
beforeEach(() => { vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } }) })

describe('ApiKeyCreate — scope request', () => {
  it('POSTs /api-keys with all form fields and the selected scopes in the request body', async () => {
    const createdKey = {
      id: 'k1',
      friendly_name: 'Test key',
      type: 'additional',
      organisation: 'Test Org',
      description: 'Test Description',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      secret: 'secret-plaintext-once',
    }
    api.post.mockResolvedValue({ data: createdKey })
    const onCreated = vi.fn()
    const user = userEvent.setup()

    render(<ApiKeyCreate onBack={vi.fn()} onCreated={onCreated} />)

    // Fill in the form fields by label.
    await user.type(screen.getByPlaceholderText(st('apiKeys.namePlaceholder')), 'Test key')
    const orgInput = screen.getByLabelText(st('apiKeys.field.organisation'))
    await user.type(orgInput, 'Test Org')

    const descInput = screen.getByLabelText(st('apiKeys.field.description'))
    await user.type(descInput, 'Test Description')

    const nameInput = screen.getByLabelText(st('apiKeys.field.contactName'))
    await user.type(nameInput, 'John Doe')

    const emailInput = screen.getByLabelText(st('apiKeys.field.contactEmail'))
    await user.type(emailInput, 'john@example.com')

    // Enable the candidates scope.
    const switches = screen.getAllByRole('switch')
    const candidatesLabel = st('apiKeys.scopes.candidates')
    const candidatesSwitch = switches.find(s => {
      const parent = s.closest('div')
      return parent?.textContent?.includes(candidatesLabel)
    })
    if (candidatesSwitch) {
      await user.click(candidatesSwitch)
    }

    // Click create.
    const createButton = screen.getByRole('button', { name: new RegExp(st('apiKeys.create'), 'i') })
    await user.click(createButton)

    // Verify the POST request was made with scopes included.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api-keys', expect.objectContaining({
        friendly_name: 'Test key',
        scopes: expect.objectContaining({ candidates: 'read' }),
      }))
    })
  })

  it('candidate dossier scopes (notes, documents, conversations, educations, references) can be enabled and sent in the POST request', async () => {
    const createdKey = {
      id: 'k2',
      friendly_name: 'Dossier key',
      type: 'additional',
      secret: 'secret-plaintext-once',
    }
    api.post.mockResolvedValue({ data: createdKey })
    const user = userEvent.setup()

    render(<ApiKeyCreate onBack={vi.fn()} onCreated={vi.fn()} />)

    // Fill in the required name field.
    await user.type(screen.getByPlaceholderText(st('apiKeys.namePlaceholder')), 'Dossier key')

    // Enable all five candidate dossier scopes.
    const switches = screen.getAllByRole('switch')
    const scopeNames = [
      'candidate_notes',
      'candidate_documents',
      'candidate_conversations',
      'candidate_educations',
      'candidate_references',
    ]

    for (const scopeName of scopeNames) {
      const label = st(`apiKeys.scopes.${scopeName}`)
      const scopeSwitch = switches.find(s => {
        const parent = s.closest('div')
        return parent?.textContent?.includes(label)
      })
      if (scopeSwitch) {
        await user.click(scopeSwitch)
      }
    }

    // Click create.
    const createButton = screen.getByRole('button', { name: new RegExp(st('apiKeys.create'), 'i') })
    await user.click(createButton)

    // Verify the POST request includes all five scopes with 'read' level.
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api-keys', expect.objectContaining({
        friendly_name: 'Dossier key',
        scopes: expect.objectContaining({
          candidate_notes: 'read',
          candidate_documents: 'read',
          candidate_conversations: 'read',
          candidate_educations: 'read',
          candidate_references: 'read',
        }),
      }))
    })
  })
})
