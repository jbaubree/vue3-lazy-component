import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  clean: true,
  rollup: {
    esbuild: {
      minify: true,
    },
    emitCJS: true,
  },
  externals: [
    'vite',
    '@vue/compiler-dom',
    '@vue/compiler-sfc',
    '@vue/compiler-core',
    '@vue/shared',
    'tinyglobby',
  ],
  declaration: true,
  failOnWarn: false,
})
