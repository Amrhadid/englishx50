import { useState } from 'react'
import { BRAND_GRADIENT } from '../lib/theme'
import { supabase } from '../lib/supabase'
import type { Challenge } from '../types'

interface PremiumModalProps {
  onClose: () => void
}

const WHATSAPP_NUMBER = '201097965058'

const FEATURES = [
  { emoji: '📚', title: 'مصدر تعليمي لكل تحدي', desc: 'مادة مختارة تبدأ بها كل تحدٍّ' },
  { emoji: '🎬', title: 'درس شرح قصير وتفاعلي', desc: 'شرح مركّز يوصّل الفكرة بسرعة' },
  { emoji: '🎤', title: 'مهمة تحدّث عملية', desc: 'تتكلّم فعليًا في كل تحدي' },
  { emoji: '🤖', title: 'تدرّب مع AI Coach', desc: 'تمرّن على النطق والمحادثة في أي وقت' },
  { emoji: '📊', title: 'تقييم واقتراحات للتطوير', desc: 'تعرف نقاط قوتك وما يحتاج تحسين' },
  { emoji: '🏆', title: 'متابعة حتى النهاية', desc: 'التزام للنهاية = نتيجة مضمونة إن شاء الله' },
]

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.6-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  )
}

export default function PremiumModal({ onClose }: PremiumModalProps) {
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'حابب اشترك في تحدي ٥٠ يوم المميز 🚀',
  )}`

  const submitCode = async () => {
    const value = code.trim()
    if (!value) {
      setCodeMsg({ ok: false, text: 'أدخل كود الاشتراك أولاً' })
      return
    }
    if (!supabase) {
      setCodeMsg({ ok: false, text: 'تعذّر التحقق الآن، تواصل معنا عبر واتساب' })
      return
    }
    setVerifying(true)
    setCodeMsg(null)

    const { data, error } = await supabase
      .from('x50_challenges')
      .select('*')
      .eq('access_code', value)

    setVerifying(false)
    const matches = (data as Challenge[] | null) ?? []
    if (error || matches.length === 0) {
      setCodeMsg({ ok: false, text: 'كود غير صحيح، تأكد منه أو اشترك للحصول على كود' })
      return
    }

    setCodeMsg({ ok: true, text: 'تم فتح التحدي ✓' })
    const target = matches[0]
    const link = target.video_url || target.pdf_url
    if (link) window.open(link, '_blank', 'noopener')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1730]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-white bg-white shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden px-6 pb-7 pt-8 text-center" style={{ background: BRAND_GRADIENT }}>
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          >
            <CloseIcon />
          </button>
          <span className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
            ✨
          </span>
          <h2 className="relative text-[22px] font-black text-white">مميزات تحدي ٥٠ يوم</h2>
          <p className="relative mt-1 text-[13px] font-semibold text-white/90">
            كل اللي تحتاجه عشان تتحدث الإنجليزية بثقة
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-2.5 px-5 py-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-[#f2eefc] bg-[#faf9ff] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                {f.emoji}
              </span>
              <div>
                <p className="text-[14px] font-extrabold text-[#1b1730]">{f.title}</p>
                <p className="text-[12px] text-[#7a7596]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-6">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:-translate-y-0.5"
          >
            <WhatsAppIcon />
            اشترك الآن عبر واتساب
          </a>
          <p className="mt-3 text-center text-[12px] text-[#a39ec0]">
            عند الاشتراك ستحصل على كود لفتح كل التحديات 🔓
          </p>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#efeafc]" />
            <span className="text-[12px] font-bold text-[#a39ec0]">عندك كود اشتراك؟</span>
            <span className="h-px flex-1 bg-[#efeafc]" />
          </div>

          {/* Code entry */}
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setCodeMsg(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitCode()}
              placeholder="أدخل كود الاشتراك هنا..."
              className="flex-1 rounded-2xl border border-[#ece7fb] bg-[#faf9ff] px-4 py-3 text-[13px] text-right outline-none transition focus:border-[#7C6FF0] focus:bg-white"
            />
            <button
              onClick={submitCode}
              disabled={verifying}
              className="shrink-0 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#A964F0]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: BRAND_GRADIENT }}
            >
              {verifying ? '...' : 'افتح'}
            </button>
          </div>
          {codeMsg && (
            <p
              className={`mt-2 text-center text-[12px] font-semibold ${
                codeMsg.ok ? 'text-[#0C7C62]' : 'text-[#C2410C]'
              }`}
            >
              {codeMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
