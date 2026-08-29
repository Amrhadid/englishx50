import { dialCountries, arabNationalities } from './countries'

const FIELD_BASE =
  'w-full rounded-2xl border px-4 py-3 text-[14px] text-right outline-none transition'
const FIELD_NORMAL = 'border-[#ece7fb] bg-[#faf9ff] focus:border-[#7C6FF0] focus:bg-white'
const FIELD_INVALID = 'border-[#E11D48] bg-[#FFF1F2] focus:border-[#E11D48]'

/** Red used for every invalid border / error message in the forms. */
export const ERROR_COLOR = '#E11D48'

/**
 * Shared look for every text input in the join / activation forms; pass
 * `true` once the field has failed validation to switch it to the red state.
 */
export function fieldClass(invalid = false): string {
  return `${FIELD_BASE} ${invalid ? FIELD_INVALID : FIELD_NORMAL}`
}

/** The plain (valid) input look, for the forms that do not validate inline. */
export const inputClass = fieldClass()

export type YesNo = 'yes' | 'no' | null

/** Dial code for an ISO country code (e.g. "EG" -> "+20"). */
export function dialCodeFor(countryCode: string): string {
  return dialCountries.find((c) => c.code === countryCode)?.dialCode ?? '+20'
}

/** Arabic label for a nationality code, or '' when nothing is selected. */
export function nationalityLabel(code: string): string {
  return arabNationalities.find((n) => n.code === code)?.label ?? ''
}

/**
 * A local phone number (the part after the dial code) is plausible: digits,
 * spaces and dashes only, 6–15 digits. Deliberately loose — the number is only
 * ever dialled by a human, so the check is here to catch typos and empty
 * submissions, not to be an authority on numbering plans.
 */
export function isValidLocalPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!/^[\d\s-]+$/.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 15
}
