import type { PluginOption } from 'vite'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'
import { lazyComponentPlugin } from 'vue3-lazy-component'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
  plugins: [
    Vue(),
    Unocss(),
    lazyComponentPlugin({ errorComponentPath: '@/components/DefaultErrorComponent.vue' }),
  ] as PluginOption[],
})
