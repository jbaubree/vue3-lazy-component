import type { Plugin } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lazyComponentPlugin, transformContent } from '../src/vitePluginLazy'

vi.mock('@vue/compiler-sfc', () => ({
  parse: vi.fn(() => ({
    descriptor: {
      template: { content: '<LazyMyComp :delay="100" :priority="\'visible-first\'" :load-data="someData" :timeout="3000" :intersection-observer="{\"rootMargin\":\"0px\"}" :error-component-path="\'@/components/Error.vue\'" />', loc: { start: { offset: 0 }, end: { offset: 200 } } },
      scriptSetup: { content: '' },
    },
  })),
}))

vi.mock('@vue/compiler-dom', () => ({
  NodeTypes: { ELEMENT: 1 },
  parse: vi.fn(() => ({
    type: 0,
    children: [
      {
        type: 1,
        tag: 'LazyMyComp',
        props: [
          { rawName: ':delay', loc: { start: { offset: 20 }, end: { offset: 33 } } },
          { rawName: ':priority', loc: { start: { offset: 34 }, end: { offset: 56 } } },
          { rawName: ':load-data', loc: { start: { offset: 57 }, end: { offset: 80 } } },
          { rawName: ':timeout', loc: { start: { offset: 81 }, end: { offset: 100 } } },
          { rawName: ':intersection-observer', loc: { start: { offset: 101 }, end: { offset: 150 } } },
          { rawName: ':error-component-path', loc: { start: { offset: 151 }, end: { offset: 200 } } },
        ],
        loc: { start: { offset: 0 }, end: { offset: 200 } },
      },
    ],
  })),
}))

vi.mock('tinyglobby', () => ({
  globSync: vi.fn().mockReturnValue(['src/components/MyComp.vue', 'src/components/MyCompSkeleton.vue']),
}))

vi.mock('../src/utils', async () => {
  return {
    getComponentFolderFromScript: vi.fn(() => './components'),
    extractRawValue: vi.fn((_, prop) => {
      const map = {
        ':delay': '100',
        ':priority': '\'visible-first\'',
        ':load-data': 'someData',
        ':timeout': '3000',
        ':intersection-observer': '{"rootMargin":"0px"}',
        ':error-component-path': '\'@/components/Error.vue\'',
      }
      return map[prop.rawName as keyof typeof map] || ''
    }),
    addImportIfNeeded: vi.fn((code, imp, imports) => {
      if (!code.includes(imp))
        imports.push(imp)
    }),
    cleanValue: vi.fn((v: string, q = '"') => v.replaceAll('"', q)),
  }
})

describe('lazyComponentPlugin (full coverage)', () => {
  type TransformFn = (code: string, name: string) => Promise<any>
  let plugin: Plugin

  beforeEach(() => {
    plugin = lazyComponentPlugin()
  })

  it('should correctly transform LazyMyComp with all props', async () => {
    const inputCode = `<template><LazyMyComp :delay="100" :priority="'visible-first'" :load-data="someData" :timeout="3000" :intersection-observer="{\"rootMargin\":\"0px\"}" :error-component-path="'@/components/Error.vue'" /></template><script setup></script>`
    const transform = plugin.transform
    let result: Awaited<ReturnType<Exclude<Plugin['transform'], undefined | false | { handler: any }>>> | undefined

    if (typeof transform === 'function') {
      result = await transform.call({} as any, inputCode, 'MyComponent.vue')
    }
    else if (transform && typeof transform === 'object' && typeof transform.handler === 'function') {
      result = await transform.handler.call({} as any, inputCode, 'MyComponent.vue')
    }

    if (typeof result !== 'string') {
      expect(result?.code).toBeDefined()
      expect(result?.code).toContain(`defineLazyComponent({ componentFactory: () => import('@/components/MyComp.vue')`)
      expect(result?.code).toContain(`loadingComponent: MyCompLoadingComponent`)
      expect(result?.code).toContain(`delay: 100`)
      expect(result?.code).toContain(`timeout: 3000`)
      expect(result?.code).toContain(`priority: 'visible-first'`)
      expect(result?.code).toContain(`loadData: someData`)
      expect(result?.code).toMatch(/intersectionObserver:.*rootMargin/)
      expect(result?.code).toContain(`errorComponent: LazyCustomErrorComponent`)
      expect(result?.code).toContain(`import LazyCustomErrorComponent from '@/components/Error.vue'`)
      expect(result?.code).toContain(`import MyCompLoadingComponent from '@/components/MyCompSkeleton.vue'`)
      expect(result?.code).toContain(`import { defineLazyComponent } from 'vue3-lazy-component'`)
    }
  })

  it('should skip transformation if not a .vue file', async () => {
    let result: any
    const transform = plugin.transform

    if (typeof transform === 'function') {
      result = await (transform as TransformFn)('some js code', 'MyComponent.js')
    }
    else if (transform && typeof transform === 'object' && typeof transform.handler === 'function') {
      result = await (transform as { handler: TransformFn }).handler('some js code', 'MyComponent.js')
    }
    expect(result).toBeUndefined()
  })

  it('should skip if no template block', async () => {
    const mockSFC = await import('@vue/compiler-sfc')
    vi.mocked(mockSFC.parse, { partial: true }).mockReturnValueOnce({
      descriptor: {
        scriptSetup: {
          content: '',
          type: 'script',
          attrs: {},
          loc: {
            source: '',
            start: { line: 0, column: 0, offset: 0 },
            end: { line: 0, column: 0, offset: 0 },
          },
        },
        filename: 'MyComponent.vue',
        source: '<template></template><script setup></script>',
        template: null,
        script: null,
        styles: [],
        customBlocks: [],
        cssVars: [],
        slotted: false,
        shouldForceReload: () => false,
      },
    })
    const result = await (plugin.transform as TransformFn)?.('<script setup></script>', 'Test.vue')
    expect(result).toBeUndefined()
  })

  it('should handle already existing defineLazyComponent import', async () => {
    const mockSFC = await import('@vue/compiler-sfc')
    vi.mocked(mockSFC.parse).mockReturnValueOnce({
      descriptor: {
        template: {
          content: '<LazyMyComp />',
          type: 'template',
          attrs: {},
          loc: {
            source: '',
            start: { line: 0, column: 0, offset: 0 },
            end: { line: 0, column: 0, offset: 0 },
          },
        },
        scriptSetup: {
          content: 'import { defineLazyComponent } from "vue3-lazy-component"',
          type: 'script',
          attrs: {},
          loc: {
            source: '',
            start: { line: 0, column: 0, offset: 0 },
            end: { line: 0, column: 0, offset: 0 },
          },
        },
        filename: 'MyComponent.vue',
        source: '<template><LazyMyComp /></template><script setup>import { defineLazyComponent } from "vue3-lazy-component"</script>',
        script: null,
        styles: [],
        customBlocks: [],
        cssVars: [],
        slotted: false,
        shouldForceReload: () => false,
      },
      errors: [],
    })
    const result = await (plugin.transform as TransformFn)?.('<template><LazyMyComp /></template><script setup>import { defineLazyComponent } from "vue3-lazy-component"</script>', 'Test.vue')
    expect(result?.code.match(/defineLazyComponent/g)?.length).toBeGreaterThan(1)
  })
})

describe('transformContent', () => {
  it('should add lazy component types to the code', () => {
    const code = `declare module 'vue' {
      MyComponent: typeof import('./MyComponent')['default'];
    }`

    const result = transformContent({ code, loadingComponentSuffix: 'Loading' })

    expect(result).toContain('import { DefineComponent, Component } from \'vue\'')
    expect(result).toContain('type LazyComponentOptions = {')
  })

  it('should rename the components to LazyComponent if they are not already prefixed', () => {
    const code = `declare module 'vue' {
      MyComponent: typeof import('./MyComponent')['default'];
      AnotherComponent: typeof import('./AnotherComponent')['default'];
    }`

    const result = transformContent({ code, loadingComponentSuffix: 'Loading' })

    expect(result).toContain('LazyMyComponent')
    expect(result).toContain('LazyAnotherComponent')
  })

  it('should not rename components that already start with Lazy', () => {
    const code = `declare module 'vue' {
      LazyMyComponent: typeof import('./MyComponent')['default'];
      LazyAnotherComponent: typeof import('./AnotherComponent')['default'];
    }`

    const result = transformContent({ code, loadingComponentSuffix: 'Loading' })

    expect(result).toContain('LazyMyComponent')
    expect(result).toContain('LazyAnotherComponent')
  })

  it('should remove lines containing the loading component suffix', () => {
    const code = `declare module 'vue' {
      MyComponent: typeof import('./MyComponent')['default'];
      MyComponentLoading: typeof import('./MyComponentLoading')['default'];
    }`

    const result = transformContent({ code, loadingComponentSuffix: 'Loading' })

    expect(result).not.toContain('MyComponentLoading')
  })

  it('should remove lines containing the error component if specified', () => {
    const code = `declare module 'vue' {
      MyComponent: typeof import('./MyComponent')['default'];
      MyComponentError: typeof import('./MyComponentError')['default'];
    }`

    const errorComponentPath = './MyComponentError'
    const result = transformContent({ code, errorComponentPath, loadingComponentSuffix: 'Loading' })

    expect(result).not.toContain('MyComponentError')
  })

  it('should handle an empty code correctly', () => {
    const code = ``

    const result = transformContent({ code, loadingComponentSuffix: 'Loading' })
    expect(result).toBe('')
  })

  it('should return the correct transformed code with errorComponentPath', () => {
    const code = `declare module 'vue' {
      MyComponent: typeof import('./MyComponent')['default'];
    }`

    const errorComponentPath = './MyComponentError'
    const result = transformContent({ code, errorComponentPath, loadingComponentSuffix: 'Loading' })

    expect(result).not.toContain('MyComponentError')
    expect(result).toContain('LazyMyComponent')
  })
})
