/**
 * NotesTabBody — the loading/error/success shell shared by every customer notes
 * sub-tab (ContactNotesTab, ScopedNotesTab, §11 — one notes surface family,
 * never a fork): four explicit UI states (§3), success always renders the same
 * CustomerNotesView. Only the error message key differs per caller (a scoped
 * list's own copy vs the generic fallback).
 */
import { useTranslation } from 'react-i18next'
import CustomerNotesView from './CustomerNotesView'
import type { ComponentProps } from 'react'

type NotesViewProps = ComponentProps<typeof CustomerNotesView>

export default function NotesTabBody({ loading, error, errorKey, ...viewProps }: {
  loading: boolean
  error: unknown
  errorKey: string
} & NotesViewProps) {
  const { t } = useTranslation('customers')
  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  if (error) return <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t(errorKey)}</div>
  return <CustomerNotesView {...viewProps} />
}
