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
 */
import type { TFunction } from 'i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { cardHead, cardBox } from './fields'
import type { TaskForm } from '../AddTaskModal'

export default function DescriptionCard({ t, form, set }: {
  t: TFunction
  form: TaskForm
  set: (k: keyof TaskForm, v: string) => void
}) {
  return (
    <div>
      <div style={cardHead}>{t('modal.description')}</div>
      <div style={cardBox}>
        {/* Description = note body — same rich editor (and its shared mic + Koios
            assist bar) as the drawer + candidate profile text. */}
        <RichTextEditor value={form.description} onChange={v => set('description', v)} />
      </div>
    </div>
  )
}
