import { supabase } from './supabase'

export interface LeadInput {
  name: string
  /** Full phone, including the dial code (e.g. "+201234567890"). */
  phone: string
  countryCode: string
  job: string
  nationality: string
  university: 'yes' | 'no' | null
  youtube: 'yes' | 'no' | null
  referral: string | null
}

/**
 * Record a join-form submission in x50_leads. Best-effort: the public form has
 * no sign-in and immediately hands off to WhatsApp, so a failure here must
 * never block that — we swallow errors and let the WhatsApp link proceed.
 */
export async function createLead(input: LeadInput): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('x50_leads').insert({
      name: input.name.trim() || null,
      phone: input.phone.trim() || null,
      country_code: input.countryCode || null,
      job: input.job.trim() || null,
      nationality: input.nationality || null,
      university: input.university,
      youtube_subscribed: input.youtube,
      referral: input.referral,
    })
  } catch {
    /* ignore — never block the WhatsApp hand-off */
  }
}
