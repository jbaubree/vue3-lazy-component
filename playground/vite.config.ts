import type { PluginOption } from 'vite'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { lazyComponentPlugin } from 'vue3-lazy-component'

export default defineConfig({
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
  plugins: [
    Vue(),
    Unocss(),
    Components(),
    lazyComponentPlugin({ errorComponentPath: '@/components/DefaultErrorComponent.vue' }),
  ] as PluginOption[],
})
