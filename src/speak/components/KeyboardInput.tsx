import { useEffect, useRef, useState } from 'react'
import { MAX_TEXT_CHARS } from '../constants'
import { T } from '../text'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
  onClose: () => void
}

/** Optional typed answer, for learners who cannot use the microphone right now. */
export default function KeyboardInput({ disabled, onSend, onClose }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <form
      className="rounded-[20px] border border-[#ece7fb] bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor="spk-typed" className="sr-only">
        {T.keyboard}
      </label>
      <textarea
        id="spk-typed"
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_TEXT_CHARS))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') onClose()
        }}
        rows={2}
        dir="ltr"
        lang="en"
        placeholder={T.typePlaceholder}
        className="spk-en w-full resize-none rounded-xl bg-[#faf9ff] px-3 py-2 text-[15px] text-[#1b1730] outline-none placeholder:text-[#a39ec0]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-full px-4 text-[13px] font-bold text-[#7a7596] transition hover:bg-[#f4f2fc]"
        >
          {T.close}
        </button>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="h-11 rounded-full bg-[#534AB7] px-6 text-[14px] font-bold text-white transition hover:bg-[#46409c] disabled:opacity-50"
        >
          {T.send}
        </button>
      </div>
    </form>
  )
}
