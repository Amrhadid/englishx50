/** Resolve `promise`, or fall back to `fallback` after `ms` (also on rejection).
 *  Used to keep the analysis pipeline moving — a hung network call must never
 *  freeze the UI forever. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}
