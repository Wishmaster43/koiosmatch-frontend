/**
 * koiosForYouHelpers — unit tests for pure helper functions (date/range
 * computation, action categorization). All inputs are injectable; no React/i18n
 * mocking needed. Fixed "now" ensures deterministic test output.
 */
import { describe, it, expect } from 'vitest'
import { resolveRange, mondayOf, toIsoDay, categoryOf, humanizeKey } from './koiosForYouHelpers'

// Fixed "now": 2026-08-26 (Wednesday) — 2026-08-24 is Monday of that week.
const now = new Date('2026-08-26T10:00:00Z')

describe('koiosForYouHelpers', () => {
  describe('resolveRange — preset period → from/to', () => {
    it('thisWeek (default): Monday through today', () => {
      const result = resolveRange('thisWeek', now, '', '')
      expect(result).toEqual({ from: '2026-08-24', to: '2026-08-26' })
    })

    it('lastWeek: previous week (Monday→Sunday)', () => {
      const result = resolveRange('lastWeek', now, '', '')
      expect(result).toEqual({ from: '2026-08-17', to: '2026-08-23' })
    })

    it('last30: today minus 29 days', () => {
      const result = resolveRange('last30', now, '', '')
      expect(result).toEqual({ from: '2026-07-28', to: '2026-08-26' })
    })

    it('custom: returns supplied from/to unchanged', () => {
      const result = resolveRange('custom', now, '2026-08-01', '2026-08-15')
      expect(result).toEqual({ from: '2026-08-01', to: '2026-08-15' })
    })

    it('thisWeek on a Monday returns that Monday through today', () => {
      const monday = new Date('2026-08-24T10:00:00Z')
      const result = resolveRange('thisWeek', monday, '', '')
      expect(result).toEqual({ from: '2026-08-24', to: '2026-08-24' })
    })

    it('thisWeek on a Sunday returns the previous Monday through that Sunday', () => {
      const sunday = new Date('2026-08-23T10:00:00Z')
      const result = resolveRange('thisWeek', sunday, '', '')
      expect(result).toEqual({ from: '2026-08-17', to: '2026-08-23' })
    })
  })

  describe('mondayOf — find week start (ISO Monday)', () => {
    it('Wednesday → that week\'s Monday', () => {
      const result = mondayOf(now)
      expect(toIsoDay(result)).toBe('2026-08-24')
    })

    it('Monday → itself', () => {
      const monday = new Date('2026-08-24T10:00:00Z')
      const result = mondayOf(monday)
      expect(toIsoDay(result)).toBe('2026-08-24')
    })

    it('Sunday → the previous Monday (ISO week)', () => {
      const sunday = new Date('2026-08-23T10:00:00Z')
      const result = mondayOf(sunday)
      expect(toIsoDay(result)).toBe('2026-08-17')
    })

    it('Friday → that week\'s Monday', () => {
      const friday = new Date('2026-08-28T10:00:00Z')
      const result = mondayOf(friday)
      expect(toIsoDay(result)).toBe('2026-08-24')
    })
  })

  describe('toIsoDay — Date → YYYY-MM-DD local', () => {
    it('format a date object as YYYY-MM-DD', () => {
      const result = toIsoDay(new Date('2026-08-26T10:00:00Z'))
      expect(result).toBe('2026-08-26')
    })

    it('zero-pad month and day', () => {
      const result = toIsoDay(new Date('2026-01-05T10:00:00Z'))
      expect(result).toBe('2026-01-05')
    })

    it('handle year-boundary dates', () => {
      const result = toIsoDay(new Date('2026-12-31T10:00:00Z'))
      expect(result).toBe('2026-12-31')
    })
  })

  describe('categoryOf — action type → bucket category', () => {
    it('koios_create_task → tasks', () => {
      expect(categoryOf('koios_create_task')).toBe('tasks')
    })

    it('koios_send_whatsapp → whatsapp', () => {
      expect(categoryOf('koios_send_whatsapp')).toBe('whatsapp')
    })

    it('koios_plan_appointment → appointments', () => {
      expect(categoryOf('koios_plan_appointment')).toBe('appointments')
    })

    it('koios_send_email → emails', () => {
      expect(categoryOf('koios_send_email')).toBe('emails')
    })

    it('koios_send_notification → emails (contains "email" pattern? no, falls to emails)', () => {
      // Note: send_notification doesn't match any pattern, so it falls to 'other'
      expect(categoryOf('koios_send_notification')).toBe('other')
    })

    it('koios_add_to_calllist → other (no "call" pattern in the checks)', () => {
      // Note: calllist doesn't match any pattern, so it falls to 'other'
      expect(categoryOf('koios_add_to_calllist')).toBe('other')
    })

    it('koios_reject_application → rejections', () => {
      expect(categoryOf('koios_reject_application')).toBe('rejections')
    })

    it('koios_apply_candidate → applications', () => {
      expect(categoryOf('koios_apply_candidate')).toBe('applications')
    })

    it('koios_birthday_reminder → birthdays', () => {
      expect(categoryOf('koios_birthday_reminder')).toBe('birthdays')
    })

    it('unknown type → other', () => {
      expect(categoryOf('koios_future_thing')).toBe('other')
    })

    it('null/undefined → other', () => {
      expect(categoryOf(null)).toBe('other')
      expect(categoryOf(undefined)).toBe('other')
    })

    it('key WITHOUT koios_ prefix still matches', () => {
      expect(categoryOf('create_task')).toBe('tasks')
      expect(categoryOf('send_whatsapp')).toBe('whatsapp')
    })
  })

  describe('humanizeKey — workflow key → readable label', () => {
    it('koios_create_task → "Create Task"', () => {
      expect(humanizeKey('koios_create_task')).toBe('Create Task')
    })

    it('koios_send_whatsapp → "Send Whatsapp"', () => {
      expect(humanizeKey('koios_send_whatsapp')).toBe('Send Whatsapp')
    })

    it('strips koios_ prefix', () => {
      expect(humanizeKey('koios_foo_bar_baz')).toBe('Foo Bar Baz')
    })

    it('handles null/undefined → "—"', () => {
      expect(humanizeKey(null)).toBe('—')
      expect(humanizeKey(undefined)).toBe('—')
      expect(humanizeKey('')).toBe('—')
    })

    it('title-cases every word', () => {
      expect(humanizeKey('koios_my_long_template_name')).toBe('My Long Template Name')
    })

    it('works on a key without koios_ prefix', () => {
      expect(humanizeKey('create_task')).toBe('Create Task')
    })
  })
})
