// Every Arabic string the /speak screens show, in one place.
import type { SpeakErrorCode } from './types'

export const T = {
  statusPill: 'جاهزة للمحادثة',
  heading: 'اتكلم إنجليزي من غير توتر',
  intro: 'محادثة قصيرة مع شريك AI يصحح لك بعد ما تخلص—من غير ما يقاطعك كل شوية.',
  dailyGoal: 'هدف اليوم: 5 دقائق',
  partnerName: 'Emma',
  partnerStatus: 'متصلة الآن',
  partnerRole: 'شريكتك في المحادثة',
  levelPrefix: 'مستواك:',
  scenariosLabel: 'اختر موقف المحادثة',
  micInstruction: 'اضغط وابدأ الكلام',
  conversationLabel: 'المحادثة',
  emptyConversation: 'اختر موقفاً واضغط على الميكروفون لتبدأ.',
  loadingAuth: 'جارٍ التحقق من حسابك…',
  loadingPremium: 'جارٍ التحقق من اشتراكك…',
  starting: 'Emma بتجهّز أول سؤال…',
  requestingMic: 'اسمح باستخدام الميكروفون للمتابعة…',
  recording: 'بسمعك دلوقتي… اضغط عند الانتهاء',
  transcribing: 'جاري تحليل إجابتك…',
  thinking: 'Emma بترد عليك…',
  speaking: 'Emma بترد عليك…',
  replay: 'إعادة سماع رد Emma',
  stopAudio: 'إيقاف الصوت',
  keyboard: 'اكتب بدل الكلام',
  cancelRecording: 'إلغاء التسجيل',
  startRecording: 'ابدأ التسجيل',
  stopRecording: 'إنهاء التسجيل',
  send: 'إرسال',
  close: 'إغلاق',
  back: 'رجوع',
  settings: 'إعدادات المحادثة',
  settingsLevel: 'مستوى المحادثة',
  settingsVoice: 'تشغيل صوت Emma',
  settingsNewChat: 'ابدأ محادثة جديدة',
  typePlaceholder: 'Type your answer in English…',
  feedbackTitle: 'ملاحظات Emma',
  feedbackOriginal: 'جملتك',
  feedbackSuggested: 'قولها بشكل أفضل',
  feedbackPositive: 'إيه اللي كان حلو؟',
  feedbackWhy: 'ليه؟',
  retry: 'حاول مرة أخرى',
  dismiss: 'حسناً',
  unsupported: 'متصفحك لا يدعم التسجيل الصوتي. جرّب Chrome أو Safari الحديث، أو اكتب إجابتك.',
  noVoice: 'الصوت غير متاح لهذا الرد — اقرأ رد Emma بالأعلى.',
  gateTitle: 'تدريب المحادثة متاح للمشتركين',
  gateBody:
    'المشتركون في EnglishX50 يقدروا يتدرّبوا على الكلام مع Emma، شريكة محادثة بالذكاء الاصطناعي تسمعك وترد عليك وتصحح لك بعد ما تخلص.',
  gatePrimary: 'اشترك الآن',
  gateSecondary: 'الرجوع للتحدي',
  min: 'د',
  sec: 'ث',
} as const

/** User-facing Arabic message for every error the feature can surface. */
export function errorMessage(code: SpeakErrorCode): string {
  switch (code) {
    case 'mic_denied':
      return 'لم يتم السماح باستخدام الميكروفون. فعّل الإذن من إعدادات المتصفح ثم حاول مرة أخرى.'
    case 'mic_missing':
      return 'لم نجد ميكروفوناً على هذا الجهاز. وصّل ميكروفوناً أو اكتب إجابتك.'
    case 'mic_busy':
      return 'الميكروفون مشغول بتطبيق آخر. أغلقه وحاول مرة أخرى.'
    case 'mic_unsupported':
      return T.unsupported
    case 'mic_failed':
      return 'تعذّر بدء التسجيل. حاول مرة أخرى.'
    case 'empty_recording':
    case 'empty_transcript':
      return 'لم نلتقط صوتاً واضحاً. اقترب من الميكروفون وحاول مرة أخرى.'
    case 'network':
      return 'تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'
    case 'timeout':
      return 'استغرقت Emma وقتاً أطول من المعتاد. حاول مرة أخرى.'
    case 'rate_limited':
      return 'وصلت للحد الأقصى من المحاولات حالياً. خذ استراحة قصيرة وحاول بعد قليل.'
    case 'transcription_failed':
      return 'تعذّر تحويل صوتك إلى نص. حاول مرة أخرى.'
    case 'ai_malformed':
    case 'ai_refused':
      return 'لم نفهم رد Emma هذه المرة. حاول مرة أخرى.'
    case 'ai_failed':
      return 'تعذّر الحصول على رد Emma. حاول مرة أخرى.'
    case 'provider_unavailable':
      return 'خدمة المحادثة غير مفعّلة حالياً. جرّب لاحقاً.'
    case 'entitlement_unavailable':
      return 'تعذّر التحقق من اشتراكك الآن. حاول بعد قليل.'
    case 'not_premium':
    case 'unauthenticated':
      return 'انتهت جلستك أو اشتراكك. أعد تحميل الصفحة.'
    case 'invalid_request':
    case 'server':
    default:
      return 'حدث خطأ غير متوقع. حاول مرة أخرى.'
  }
}
