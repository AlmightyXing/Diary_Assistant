import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  root: 'frontend',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    electron([
      {
        entry: resolve(__dirname, 'electron/main.ts'),
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
          },
        },
      },
      {
        entry: resolve(__dirname, 'electron/preload.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
          },
        },
      }
    ]),
    renderer(),
  ],
})
