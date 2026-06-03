import { PlayIcon } from './icons'

export default function YouTubePlaceholder() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-8">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl bg-[#ececf1]">
        <button
          aria-label="Play video"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-lg transition hover:scale-105"
        >
          <PlayIcon className="ml-1 h-8 w-8 text-[#534AB7]" />
        </button>
      </div>
    </section>
  )
}
