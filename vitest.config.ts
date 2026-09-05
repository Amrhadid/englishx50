import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test runner for the /speak feature. The Edge Function suite (web-standard
// Request/Response only) runs under Node; the client suites opt into jsdom
// with a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/speak/**/*.test.{ts,tsx}', 'src/lib/**/*.test.ts', 'supabase/functions/speak-turn/**/*.test.ts'],
    setupFiles: ['src/speak/__tests__/setup.ts'],
    restoreMocks: true,
  },
})
