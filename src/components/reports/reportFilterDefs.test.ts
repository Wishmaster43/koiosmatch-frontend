/**
 * reportFilterDefs — tests for status and workflow filter group builders.
 */
import { describe, it, expect, vi } from 'vitest'
import { buildStatusGroup, buildWorkflowGroup } from './reportFilterDefs'
import type { TFunction } from 'i18next'

describe('reportFilterDefs', () => {
  // Mock t() that returns the translation key (simulating i18next behavior where keys are used as fallback).
  const mockT: TFunction = ((key: string) => key) as TFunction

  describe('buildStatusGroup', () => {
    it('builds a status filter group with options from distinct row values', () => {
      const statusValues = ['sent', 'failed', 'pending']
      const rows = [
        { status: 'sent' },
        { status: 'sent' },
        { status: 'failed' },
      ]
      const onToggle = vi.fn()

      const group = buildStatusGroup(mockT, statusValues, [], rows, 'messages.filters.status', onToggle)

      expect(group.key).toBe('status')
      expect(group.label).toBe('messages.filters.status')
      expect(group.options).toBeDefined()
      if (group.options) {
        expect(group.options).toHaveLength(3)
        expect(group.options[0]).toMatchObject({
          value: 'sent',
          label: 'messages.status.sent',
          count: 2,
        })
      }
    })

    it('applies keyTransform to status key for i18n lookup', () => {
      const statusValues = ['SENT', 'FAILED']
      const rows = [{ status: 'SENT' }, { status: 'FAILED' }]
      const onToggle = vi.fn()

      const group = buildStatusGroup(
        mockT,
        statusValues,
        [],
        rows,
        'runs.filters.status',
        onToggle,
        (s: string) => s.toLowerCase(),
      )

      expect(group.options).toBeDefined()
      if (group.options) {
        expect(group.options[0].label).toBe('runs.status.sent')
      }
    })

    it('calls onToggle when option is toggled', () => {
      const statusValues = ['sent']
      const rows = [{ status: 'sent' }]
      const onToggle = vi.fn()

      const group = buildStatusGroup(mockT, statusValues, [], rows, 'test.label', onToggle)

      group.onToggle?.('sent')
      expect(onToggle).toHaveBeenCalledWith('sent')
    })
  })

  describe('buildWorkflowGroup', () => {
    it('builds a workflow filter group with search-select type', () => {
      const workflows = ['notify-recruiter', 'send-email']
      const rows = [
        { workflow_name: 'notify-recruiter' },
        { workflow_name: 'notify-recruiter' },
        { workflow_name: 'send-email' },
      ]
      const onToggle = vi.fn()

      const group = buildWorkflowGroup(mockT, workflows, [], rows, 'runs.filters.workflow', onToggle)

      expect(group.key).toBe('workflow')
      expect(group.type).toBe('search-select')
      expect(group.label).toBe('runs.filters.workflow')
      expect(group.options).toBeDefined()
      if (group.options) {
        expect(group.options).toHaveLength(2)
        expect(group.options[0]).toMatchObject({
          value: 'notify-recruiter',
          label: 'notify-recruiter',
          count: 2,
        })
      }
    })

    it('preserves workflow names in labels (no transform)', () => {
      const workflows = ['Notify-Recruiter', 'Send-Email']
      const rows = [
        { workflow_name: 'Notify-Recruiter' },
        { workflow_name: 'Send-Email' },
      ]
      const onToggle = vi.fn()

      const group = buildWorkflowGroup(mockT, workflows, [], rows, 'test.workflows', onToggle)

      expect(group.options).toBeDefined()
      if (group.options) {
        expect(group.options[0].label).toBe('Notify-Recruiter')
        expect(group.options[1].label).toBe('Send-Email')
      }
    })

    it('calls onToggle when workflow is selected', () => {
      const workflows = ['test-workflow']
      const rows = [{ workflow_name: 'test-workflow' }]
      const onToggle = vi.fn()

      const group = buildWorkflowGroup(mockT, workflows, [], rows, 'test.label', onToggle)

      group.onToggle?.('test-workflow')
      expect(onToggle).toHaveBeenCalledWith('test-workflow')
    })
  })
})
