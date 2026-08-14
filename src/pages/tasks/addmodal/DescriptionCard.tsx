/**
 * DescriptionCard — the "Omschrijving" card of AddTaskModal.
 *
 * PUNT 14 (Danny 08-08: "de omschrijving staat te hoog, die moet naar beneden"):
 * the free-text block used to sit INSIDE the first card, above planning /
 * assignment / links, so the biggest field came before every short field. It is
 * its own full-width card now, rendered LAST — below all the other fields — a
 * pure order change; the value still rides the same `form.description` key into
 * the same POST/PATCH body.
 *
 * PUNT 16 (Danny 08-08: "bij een nieuwe taak ontbreekt het spraak-icoon dat
 * notities wél hebben"): the mic is ALREADY here — `RichTextEditor` mounts the
 * shared `RichTextAssistBar` (the same `KoiosVoiceButton` the note composer
 * uses, same append rule, same honest unsupported/insecure gates) on every
 * editor by default. So this card passes NO mic of its own: a second
 * `toolbarExtra` mic would render two identical buttons side by side, exactly
 * the per-screen copy §11 forbids. If the mic ever disappears here, fix the
 * shared bar — never re-add a local one.
 *
 * TASK-ASSIST-ACTIONS-1 (Danny 14-08: "bij nieuwe taak ook actiepunten en auto
 * en wizzard"): a new task's description is written as a briefing/conversation
 * note (subtasks come out of it), not a plain description — same shape as
 * +Match's Opmerkingen — so it opts INTO the third Koios mode via
 * `assistModes={['improve', 'summarize', 'actions']}` (ACTIONS-SCOPE-DEFAULT-FLIP's
 * default is improve+summarize only). The Wizard/Auto switch Danny referenced is
 * the SAME per-user setting the note popup shows next to its own assist block
 * (`NoteKoiosModeToggle`, `useMyKoiosMode` — one shared preference, not a
 * per-field one) — mirrored here next to the card title rather than forked.
 */
import type { TFunction } from 'i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import NoteKoiosModeToggle from '@/components/drawer/tabs/notes/NoteKoiosModeToggle'
import { cardHead, cardBox } from './fields'
import type { TaskForm } from '../AddTaskModal'

export default function DescriptionCard({ t, form, set }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={cardHead}>{t('modal.description')}</div>
        {/* TASK-ASSIST-ACTIONS-1: same Wizard/Auto switch as the note popup — one
            shared per-user preference, mirrored here, not a forked copy. */}
        <NoteKoiosModeToggle />
      </div>
      <div style={cardBox}>
        {/* Description = note body — same rich editor (and its shared mic + Koios
            assist bar) as the drawer + candidate profile text. Actiepunten opted
            in (TASK-ASSIST-ACTIONS-1) so a task's briefing can generate subtasks. */}
        <RichTextEditor value={form.description} onChange={v => set('description', v)} assistModes={['improve', 'summarize', 'actions']} />
      </div>
    </div>
  )
}
