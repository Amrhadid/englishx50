import { dialCountries, arabNationalities } from './countries'

/** Shared look for every text input in the join / activation forms. */
export const inputClass =
  'w-full rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[14px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white'

export type YesNo = 'yes' | 'no' | null

/** Dial code for an ISO country code (e.g. "EG" -> "+20"). */
export function dialCodeFor(countryCode: string): string {
  return dialCountries.find((c) => c.code === countryCode)?.dialCode ?? '+20'
}

/** Arabic label for a nationality code, or '' when nothing is selected. */
export function nationalityLabel(code: string): string {
  return arabNationalities.find((n) => n.code === code)?.label ?? ''
}
