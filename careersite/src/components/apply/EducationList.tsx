import { useState } from 'react'
import { strings } from '@/strings'
import { useEntryDraft } from '@/hooks/useEntryDraft'
import { dateToMonth, monthToDate } from '@/lib/monthDate'
import type { EducationEntry } from '@/types'

interface EducationListProps {
  entries: EducationEntry[]
  onChange: (entries: EducationEntry[]) => void
}

const EMPTY_ENTRY: EducationEntry = {
  name: '',
  organisation: '',
  issued_at: '',
  license_number: '',
}

// Repeatable "Opleiding" block — same inline add/edit sub-form pattern as
// ExperienceList (shared via useEntryDraft), just a different, smaller field set.
export function EducationList({ entries, onChange }: EducationListProps) {
  const { state, openAdd, openEdit, close, updateDraft } = useEntryDraft<EducationEntry>(EMPTY_ENTRY)
  const [entryError, setEntryError] = useState<string | undefined>()

  // Name/diploma is required WITHIN the entry (mirrors the backend's
  // required_with:educations rule) — blocked here before it ever reaches the list.
  const handleSave = () => {
    if (!state) return
    if (!state.draft.name.trim()) {
      setEntryError(strings.apply.education.nameRequired)
      return
    }
    const next = [...entries]
    if (state.editingIndex === null) next.push(state.draft)
    else next[state.editingIndex] = state.draft
    onChange(next)
    setEntryError(undefined)
    close()
  }

  const handleCancel = () => {
    setEntryError(undefined)
    close()
  }

  const handleRemove = (index: number) => onChange(entries.filter((_, i) => i !== index))

  return (
    <div className="apply-form__section">
      <h3 className="apply-form__section-title">{strings.apply.education.sectionTitle}</h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={index}>
          <div className="entry-card__body">
            <strong>{entry.name}</strong>
            {entry.organisation ? <span> · {entry.organisation}</span> : null}
          </div>
          <div className="entry-card__actions">
            <button type="button" className="btn btn--secondary" onClick={() => openEdit(index, entry)}>
              {strings.apply.education.editLabel}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => handleRemove(index)}>
              {strings.apply.education.removeLabel}
            </button>
          </div>
        </div>
      ))}

      {state ? (
        <div className="entry-form">
          <label className="apply-form__field">
            <span className="required-marker">{strings.apply.education.name}</span>
            <input
              value={state.draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              aria-required="true"
            />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.education.organisation}</span>
            <input
              value={state.draft.organisation}
              onChange={(event) => updateDraft({ organisation: event.target.value })}
            />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.education.issuedDate}</span>
            <input
              type="month"
              value={dateToMonth(state.draft.issued_at)}
              onChange={(event) => updateDraft({ issued_at: monthToDate(event.target.value) })}
            />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.education.licenseNumber}</span>
            <input
              value={state.draft.license_number}
              onChange={(event) => updateDraft({ license_number: event.target.value })}
            />
          </label>
          {entryError ? <span className="field-error" role="alert">{entryError}</span> : null}
          <div className="entry-form__actions">
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {state.editingIndex === null ? strings.apply.education.saveButton : strings.apply.education.saveEditButton}
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleCancel}>
              {strings.apply.education.cancelButton}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--secondary" onClick={openAdd}>
          {strings.apply.education.addButton}
        </button>
      )}
    </div>
  )
}
