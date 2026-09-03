// Shared Vitest setup for the /speak suites. Runs for the Node (Edge Function)
// suite too, so every browser shim is guarded.
import { afterEach } from 'vitest'

if (typeof window !== 'undefined') {
  // jsdom implements neither media playback nor object URLs.
  const proto = window.HTMLMediaElement.prototype
  Object.defineProperty(proto, 'play', { configurable: true, writable: true, value: () => Promise.resolve() })
  Object.defineProperty(proto, 'pause', { configurable: true, writable: true, value: () => {} })
  Object.defineProperty(proto, 'load', { configurable: true, writable: true, value: () => {} })
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock'
    window.URL.revokeObjectURL = () => {}
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

afterEach(async () => {
  if (typeof window !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})
