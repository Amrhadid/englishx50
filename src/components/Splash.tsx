/**
 * Lightweight full-screen loading state shown while the onboarding /
 * subscription status is still resolving. Prevents the "wrong homepage flash"
 * — without it a paid user can briefly see the marketing page (or vice-versa)
 * before `premiumActive` settles.
 */
export default function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white" dir="rtl">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white"
        style={{ background: 'linear-gradient(135deg, #7C6FF0 0%, #A964F0 45%, #F25C8A 100%)' }}
      >
        50
      </span>
      <span
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#ECEAFF] border-t-[#8B5CF6]"
        aria-label="جارٍ التحميل"
      />
    </div>
  )
}
