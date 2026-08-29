import { Field, inputCls, ListingFields, PropertyFromContact } from './leadShared'
import { DateField, TimeField } from '../common/DateTimeFields'

/**
 * Field subset a cold caller is allowed to set (mirrors the backend's
 * CALLER_EDITABLE list in leads.service.js) — no assignment/status/admin fields.
 * Address/Area are never entered here — they always mirror the linked contact.
 */
export default function LeadFormFields({ form, setField, errors, contact, contactLoading }) {
  return (
    <div className="space-y-5">
      <Field label="Landlord Name" required error={errors.landlordName}>
        <input
          value={form.landlordName}
          onChange={(e) => setField('landlordName', e.target.value)}
          placeholder="Full name"
          className={inputCls(errors.landlordName)}
        />
      </Field>

      <PropertyFromContact contact={contact} loading={contactLoading} />

      <ListingFields form={form} setField={setField} errors={errors} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" required error={errors.phone}>
          <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+27831234567" className={inputCls(errors.phone)} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" className={inputCls(false)} />
        </Field>
      </div>

      <Field label="Comments" hint="Anything useful for whoever picks this up">
        <textarea
          value={form.comments}
          onChange={(e) => setField('comments', e.target.value)}
          placeholder="Notes about this lead..."
          rows={3}
          className={`${inputCls(false)} resize-none`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Availability">
          <input value={form.availability} onChange={(e) => setField('availability', e.target.value)} placeholder="Weekday mornings" className={inputCls(false)} />
        </Field>
        <Field label="Best Call Time">
          <input value={form.bestCallTime} onChange={(e) => setField('bestCallTime', e.target.value)} placeholder="8am - 11am" className={inputCls(false)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Follow-up Date">
          <DateField value={form.followUpDate} onChange={(v) => setField('followUpDate', v)} className={inputCls(false)} />
        </Field>
        <Field label="Appointment Date">
          <DateField value={form.appointmentDate} onChange={(v) => setField('appointmentDate', v)} className={inputCls(false)} />
        </Field>
      </div>

      <Field label="Appointment Time">
        <TimeField value={form.appointmentTime} onChange={(v) => setField('appointmentTime', v)} className={inputCls(false)} />
      </Field>
    </div>
  )
}
