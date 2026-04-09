import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/renderer/src/test/setup.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@engine': resolve(__dirname, 'src/renderer/src/engine'),
      '@store': resolve(__dirname, 'src/renderer/src/store'),
      '@components': resolve(__dirname, 'src/renderer/src/components')
    }
  }
})
