import { defineConfig, presetIcons, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetIcons({
      prefix: 'icon-',
      scale: 1,
      warn: true,
    }),
    presetUno(),
  ],
})
