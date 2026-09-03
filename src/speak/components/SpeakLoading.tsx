/** Full-screen loading state for the auth / entitlement checks. */
export default function SpeakLoading({ label }: { label: string }) {
  return (
    <div className="spk flex min-h-screen flex-col items-center justify-center gap-5" dir="rtl">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white"
        style={{ background: 'linear-gradient(135deg, #534AB7 0%, #7C6FF0 100%)' }}
        aria-hidden="true"
      >
        50
      </span>
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#ECEAFF] border-t-[#534AB7]" aria-hidden="true" />
      <p className="text-[14px] font-semibold text-[#7a7596]" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  )
}
