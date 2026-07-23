import { useState } from 'react'
import { strings } from '../../strings'
import { useEntryDraft } from '../../hooks/useEntryDraft'
import { dateToMonth, monthToDate } from '../../lib/monthDate'
import type { ExperienceEntry } from '../../types'

interface ExperienceListProps {
  entries: ExperienceEntry[]
  onChange: (entries: ExperienceEntry[]) => void
}

const EMPTY_ENTRY: ExperienceEntry = {
  company: '',
  title: '',
  location: '',
  start_date: '',
  end_date: '',
  responsibilities: '',
  achievements: '',
}

// Repeatable "Werkervaring" block (jaicob-style reference form) — an inline
// sub-form (never a modal, keeping the careersite dependency-free) adds/edits
// one entry at a time; saved entries render as compact cards. Empty state is
// just the add button, no extra chrome.
export function ExperienceList({ entries, onChange }: ExperienceListProps) {
  const { state, openAdd, openEdit, close, updateDraft } = useEntryDraft<ExperienceEntry>(EMPTY_ENTRY)
  const [entryError, setEntryError] = useState<string | undefined>()

  // Company is required WITHIN the entry (mirrors the backend's
  // required_with:experiences rule) — blocked here before it ever reaches the list.
  const handleSave = () => {
    if (!state) return
    if (!state.draft.company.trim()) {
      setEntryError(strings.apply.experience.companyRequired)
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
      <h3 className="apply-form__section-title">{strings.apply.experience.sectionTitle}</h3>

      {entries.map((entry, index) => (
        <div className="entry-card" key={index}>
          <div className="entry-card__body">
            <strong>{entry.company}</strong>
            {entry.title ? <span> · {entry.title}</span> : null}
          </div>
          <div className="entry-card__actions">
            <button type="button" className="btn btn--secondary" onClick={() => openEdit(index, entry)}>
              {strings.apply.experience.editLabel}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => handleRemove(index)}>
              {strings.apply.experience.removeLabel}
            </button>
          </div>
        </div>
      ))}

      {state ? (
        <div className="entry-form">
          <label className="apply-form__field">
            <span className="required-marker">{strings.apply.experience.company}</span>
            <input
              value={state.draft.company}
              onChange={(event) => updateDraft({ company: event.target.value })}
              aria-required="true"
            />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.experience.title}</span>
            <input value={state.draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.experience.location}</span>
            <input value={state.draft.location} onChange={(event) => updateDraft({ location: event.target.value })} />
          </label>
          <div className="apply-form__row">
            <label className="apply-form__field">
              <span>{strings.apply.experience.startDate}</span>
              <input
                type="month"
                value={dateToMonth(state.draft.start_date)}
                onChange={(event) => updateDraft({ start_date: monthToDate(event.target.value) })}
              />
            </label>
            <label className="apply-form__field">
              <span>{strings.apply.experience.endDate}</span>
              <input
                type="month"
                value={dateToMonth(state.draft.end_date)}
                onChange={(event) => updateDraft({ end_date: monthToDate(event.target.value) })}
              />
            </label>
          </div>
          <label className="apply-form__field">
            <span>{strings.apply.experience.responsibilities}</span>
            <textarea
              value={state.draft.responsibilities}
              onChange={(event) => updateDraft({ responsibilities: event.target.value })}
            />
          </label>
          <label className="apply-form__field">
            <span>{strings.apply.experience.achievements}</span>
            <textarea
              value={state.draft.achievements}
              onChange={(event) => updateDraft({ achievements: event.target.value })}
            />
          </label>
          {entryError ? <span className="field-error" role="alert">{entryError}</span> : null}
          <div className="entry-form__actions">
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              {state.editingIndex === null ? strings.apply.experience.saveButton : strings.apply.experience.saveEditButton}
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleCancel}>
              {strings.apply.experience.cancelButton}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--secondary" onClick={openAdd}>
          {strings.apply.experience.addButton}
        </button>
      )}
    </div>
  )
}
