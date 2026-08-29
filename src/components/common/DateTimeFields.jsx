import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import { format, parse, startOfDay, isValid } from 'date-fns'
import { CalendarDays, Clock } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'
import './datepicker-overrides.css'

const CustomButtonInput = forwardRef(function CustomButtonInput(
  { value, onClick, placeholder, className, disabled, icon: Icon },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`${className} flex items-center justify-between gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <span className={value ? '' : 'text-[#6B7280]/50 dark:text-[#A1A1AA]/40'}>{value || placeholder}</span>
      <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" strokeWidth={1.75} />
    </button>
  )
})

/**
 * Date-only picker for follow-up/appointment/scheduling dates. Defaults to blocking
 * past days (minDate = today) — pass allowPast to opt out for fields that legitimately
 * need historical dates.
 */
export function DateField({ value, onChange, className, placeholder = 'Select date', disabled, allowPast = false }) {
  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : null
  const selected = parsed && isValid(parsed) ? parsed : null

  return (
    <DatePicker
      selected={selected}
      onChange={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
      minDate={allowPast ? undefined : startOfDay(new Date())}
      dateFormat="d MMM yyyy"
      placeholderText={placeholder}
      disabled={disabled}
      customInput={<CustomButtonInput className={className} placeholder={placeholder} icon={CalendarDays} />}
      popperPlacement="bottom-start"
      showPopperArrow={false}
    />
  )
}

/** Time-only picker (dropdown list, 15-min steps by default) — 24h "HH:mm" value. */
export function TimeField({ value, onChange, className, placeholder = 'Select time', disabled, interval = 15 }) {
  const parsed = value ? parse(value, 'HH:mm', new Date()) : null
  const selected = parsed && isValid(parsed) ? parsed : null

  return (
    <DatePicker
      selected={selected}
      onChange={(date) => onChange(date ? format(date, 'HH:mm') : '')}
      showTimeSelect
      showTimeSelectOnly
      timeIntervals={interval}
      timeCaption="Time"
      dateFormat="HH:mm"
      placeholderText={placeholder}
      disabled={disabled}
      customInput={<CustomButtonInput className={className} placeholder={placeholder} icon={Clock} />}
      popperPlacement="bottom-start"
      showPopperArrow={false}
    />
  )
}
