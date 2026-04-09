import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@engine': resolve('src/renderer/src/engine'),
        '@store': resolve('src/renderer/src/store'),
        '@components': resolve('src/renderer/src/components')
      }
    },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['src/renderer/src/test/setup.ts']
    }
  }
})
