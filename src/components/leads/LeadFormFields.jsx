import { Field, inputCls } from './leadShared'

/**
 * Field subset a cold caller is allowed to set (mirrors the backend's
 * CALLER_EDITABLE list in leads.service.js) — no assignment/status/admin fields.
 */
export default function LeadFormFields({ form, setField, errors, areas }) {
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

      <Field label="Property Address" required error={errors.propertyAddress} hint="What did the landlord tell you about the property?">
        <input
          value={form.propertyAddress}
          onChange={(e) => setField('propertyAddress', e.target.value)}
          placeholder="123 Main St, City, 0000"
          className={inputCls(errors.propertyAddress)}
        />
      </Field>

      <Field label="Area" required error={errors.area}>
        <select value={form.area} onChange={(e) => setField('area', e.target.value)} className={inputCls(errors.area)}>
          <option value="">-- Select area --</option>
          {Array.isArray(areas) && areas.map((a) => (
            <option key={a._id} value={a._id}>{a.name}</option>
          ))}
        </select>
      </Field>

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
          <input type="date" value={form.followUpDate} onChange={(e) => setField('followUpDate', e.target.value)} className={inputCls(false)} />
        </Field>
        <Field label="Appointment Date">
          <input type="date" value={form.appointmentDate} onChange={(e) => setField('appointmentDate', e.target.value)} className={inputCls(false)} />
        </Field>
      </div>

      <Field label="Appointment Time">
        <input value={form.appointmentTime} onChange={(e) => setField('appointmentTime', e.target.value)} placeholder="10:00" className={inputCls(false)} />
      </Field>
    </div>
  )
}
