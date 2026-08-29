import { useEffect, useRef, useState } from 'react'
import { dialCountries, arabNationalities } from '../lib/countries'
import { ERROR_COLOR, type YesNo } from '../lib/form'

/**
 * The shared form controls for the join form and the activation panel.
 *
 * These used to live inside PremiumModal; they're extracted here so the join
 * page (/join) and the redeem panel (/challenge) can each use them without one
 * importing the other.
 */

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 opacity-60" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The red message under a field that failed validation. Renders nothing when
 * there is no error, so callers can pass the error straight through.
 */
export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1.5 text-[13px] font-bold" style={{ color: ERROR_COLOR }}>
      {children}
    </p>
  )
}

// Close the dropdown when clicking anywhere outside of it.
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return { open, setOpen, ref }
}

/**
 * Searchable country-code picker for the phone field. Tracks the selected
 * country by its ISO code (dial codes are not unique, e.g. +1 for US/CA).
 */
export function PhoneCodeSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { open, setOpen, ref } = useDropdown()
  const [search, setSearch] = useState('')
  const selected = dialCountries.find((c) => c.code === value) ?? dialCountries[0]
  const q = search.trim()
  const list = q
    ? dialCountries.filter(
        (c) => c.name.includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q.toLowerCase()),
      )
    : dialCountries
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full items-center gap-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-3 py-3 text-[13px] font-semibold text-[#8a85a0] transition hover:border-[#cfc6f5]"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span dir="ltr">{selected.dialCode}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-[#ece7fb] bg-white shadow-xl">
          <div className="border-b border-[#f2eefc] p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن دولة أو كود..."
              className="w-full rounded-xl border border-[#ece7fb] bg-[#faf9ff] px-3 py-2 text-[12.5px] text-right outline-none focus:border-[#7C6FF0]"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px] text-[#a39ec0]">لا توجد نتائج</p>
            ) : (
              list.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => {
                    onChange(c.code)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-right text-[13px] transition hover:bg-[#f6f4ff] ${
                    c.code === value ? 'bg-[#f1edff]' : ''
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate text-[#1b1730]">{c.name}</span>
                  <span dir="ltr" className="text-[#8a85a0]">
                    {c.dialCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Arab-only nationality picker. */
export function NationalitySelect({
  value,
  onChange,
  invalid = false,
}: {
  value: string
  onChange: (code: string) => void
  invalid?: boolean
}) {
  const { open, setOpen, ref } = useDropdown()
  const selected = arabNationalities.find((n) => n.code === value)
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-invalid={invalid}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-[14px] outline-none transition ${
          invalid
            ? 'border-[#E11D48] bg-[#FFF1F2]'
            : 'border-[#ece7fb] bg-[#faf9ff] hover:border-[#cfc6f5]'
        }`}
      >
        {selected ? (
          <span className="flex items-center gap-2 text-[#1b1730]">
            <span className="text-base">{selected.flag}</span>
            {selected.label}
          </span>
        ) : (
          <span style={invalid ? { color: ERROR_COLOR } : undefined} className={invalid ? '' : 'text-[#8a85a0]'}>
            الجنسية
          </span>
        )}
        <ChevronIcon />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-20 mt-2 overflow-hidden rounded-2xl border border-[#ece7fb] bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto">
            {arabNationalities.map((n) => (
              <button
                type="button"
                key={n.code}
                onClick={() => {
                  onChange(n.code)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-right text-[13px] transition hover:bg-[#f6f4ff] ${
                  n.code === value ? 'bg-[#f1edff]' : ''
                }`}
              >
                <span className="text-base">{n.flag}</span>
                <span className="flex-1 text-[#1b1730]">{n.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const optionClass = (active: boolean, invalid = false) => {
  if (active)
    return 'cursor-pointer rounded-2xl border-2 border-[#7C6FF0] bg-[#f1edff] p-3 text-center text-[14px] font-bold text-[#7C6FF0]'
  if (invalid)
    return 'cursor-pointer rounded-2xl border border-[#E11D48] bg-[#FFF1F2] p-3 text-center text-[14px] font-semibold text-[#E11D48] transition'
  return 'cursor-pointer rounded-2xl border border-[#ece7fb] bg-white p-3 text-center text-[14px] font-semibold text-[#9a95ad] transition hover:border-[#cfc6f5]'
}

export function ChoiceSelector({
  label,
  options,
  value,
  onChange,
  invalid = false,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string | null
  onChange: (v: string) => void
  invalid?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-[14px] font-bold text-[#1b1730]">{label}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={optionClass(value === o.value, invalid)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function YesNoSelector({
  label,
  value,
  onChange,
  invalid = false,
}: {
  label: string
  value: YesNo
  onChange: (v: 'yes' | 'no') => void
  invalid?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-[14px] font-bold text-[#1b1730]">{label}</p>
      <div className="flex gap-2.5">
        <button
          type="button"
          className={`flex-1 ${optionClass(value === 'yes', invalid)}`}
          onClick={() => onChange('yes')}
        >
          نعم
        </button>
        <button
          type="button"
          className={`flex-1 ${optionClass(value === 'no', invalid)}`}
          onClick={() => onChange('no')}
        >
          لا
        </button>
      </div>
    </div>
  )
}
