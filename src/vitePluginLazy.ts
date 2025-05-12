import type { Plugin } from 'vite'
import type { VitePluginOptions } from './types'
import fs from 'node:fs'
import path from 'node:path'
import { NodeTypes, parse as parseTemplateAST } from '@vue/compiler-dom'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { globSync } from 'tinyglobby'
import { addImportIfNeeded, cleanValue, extractRawValue } from './utils'

export function transformContent({ code, errorComponentPath, loadingComponentSuffix }: { code: string, errorComponentPath?: string, loadingComponentSuffix: string }): string {
  const lazyTypeDef = `import { DefineComponent } from 'vue';
        
type DeepPartial<T> = Partial<{
    [P in keyof T]: DeepPartial<T[P]> | {
        [key: string]: string | object;
    };
}>;

type LazyComponentOptions = {
  delay?: number;
  errorComponentPath?: string;
  loadData?: () => Promise<unknown>;
  timeout?: number;
  priority?: 'visible-first' | 'immediate';
  intersectionObserver: IntersectionObserverInit;
}\n\n`

  const defaultErrorComponent = errorComponentPath ? path.basename(errorComponentPath) : undefined
  const suffixesToExclude = [loadingComponentSuffix]
  if (defaultErrorComponent) {
    suffixesToExclude.push(defaultErrorComponent)
  }
  const filteredCode = code
    .split('\n')
    .filter(line => !suffixesToExclude.some(suffix => line.includes(suffix)))
    .join('\n')

  const withType = filteredCode.replace(/(?=^declare module ['"]vue['"]\s*\{)/m, lazyTypeDef)
  return withType.replace(
    /^(\s*)([A-Z]\w+):\s+typeof import\((.+?)\)\['default'\]/gm,
    (_, indent, originalName, importPath) => {
      const newName = originalName.startsWith('Lazy') ? originalName : `Lazy${originalName}`
      return `${indent}${newName}: typeof import(${importPath})['default'] extends DefineComponent<infer PropsOrPropOptions, infer RawBindings, infer D, infer C, infer M, infer Mixin, infer Extends, infer E, infer EE, infer PP, infer Props, infer Emits>
              ? DefineComponent<PropsOrPropOptions & DeepPartial<LazyComponentOptions>, RawBindings, D, C, M, Mixin, Extends, E, EE, PP, Props & DeepPartial<LazyComponentOptions>, Emits> 
              : never`
    },
  )
}

export function lazyComponentPlugin(options: VitePluginOptions = {}): Plugin {
  const {
    delay,
    timeout,
    priority,
    intersectionObserver,
    errorComponentPath,
    loadingComponentSuffix = 'Skeleton',
    dtsPath = './components.d.ts',
  } = options

  return {
    configureServer(server) {
      if (!fs.existsSync(dtsPath))
        return

      const ext = '.d.ts'
      const base = path.basename(dtsPath, ext)
      const dir = path.dirname(dtsPath)
      const targetPath = path.join(dir, `${base}-lazy${ext}`)

      let lastContent = ''
      const copyTransformed = (): void => {
        const original = fs.readFileSync(dtsPath, 'utf8')
        const transformed = transformContent({ code: original, errorComponentPath, loadingComponentSuffix })
        if (transformed !== lastContent) {
          fs.writeFileSync(targetPath, transformed, 'utf8')
          lastContent = transformed
        }
      }

      copyTransformed()
      fs.watchFile(dtsPath, copyTransformed)

      server.httpServer?.on('close', () => {
        fs.unwatchFile(dtsPath)
      })
    },
    name: 'vite-plugin-vue3-lazy-component',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.vue'))
        return

      const sfc = parseSFC(code)
      const descriptor = sfc.descriptor
      const template = descriptor.template?.content
      const scriptSetup = descriptor.scriptSetup?.content ?? ''
      const templateBlock = descriptor.template

      if (!template || !templateBlock)
        return

      const ast = parseTemplateAST(template, { comments: false })

      let mutatedTemplate = template
      const imports: string[] = []
      let needsDefineLazyComponent = false

      const transformLazyNodes = (node: any): void => {
        if (node.type === NodeTypes.ELEMENT && node.tag.startsWith('Lazy')) {
          const components = globSync(path.resolve('src/**/*.vue'))
          const componentName = node.tag.replace(/^Lazy/, '')
          const componentPath = components.find(c => c.endsWith(`${componentName}.vue`))
          const skeletonName = `${componentName}${loadingComponentSuffix}`
          const skeletonPath = components.find(c => c.endsWith(`${skeletonName}.vue`))
          const componentFactory = `() => import('@/${componentPath?.replace('src/', '')}')`
          const loadingComponent = `@/${skeletonPath?.replace('src/', '')}`
          const loadingComponentVar = `${componentName}LoadingComponent`
          addImportIfNeeded(scriptSetup, `import ${loadingComponentVar} from '${loadingComponent}'`, imports)
          const loadDataProp = node.props.find((p: Record<string, string>) => [':load-data', ':loadData', 'load-data', 'loadData'].includes(p.rawName || p.name))
          const errorComponentPathProp = node.props.find((p: Record<string, string>) => [':error-component-path', ':errorComponentPath', 'error-component-path', 'errorComponentPath'].includes(p.rawName || p.name))
          const delayProp = node.props.find((p: Record<string, string>) => [':delay', 'delay'].includes(p.rawName || p.name))
          const timeoutProp = node.props.find((p: Record<string, string>) => [':timeout', 'timeout'].includes(p.rawName || p.name))
          const priorityProp = node.props.find((p: Record<string, string>) => [':priority', 'priority'].includes(p.rawName || p.name))
          const intersectionObserverProp = node.props.find((p: Record<string, string>) => [':intersection-observer', 'intersectionObserver'].includes(p.rawName || p.name))

          const lazyOptions: Record<string, string | number | object> = {
            componentFactory,
            loadingComponent: loadingComponentVar,
          }
          const errorPath = errorComponentPathProp ? extractRawValue(template, errorComponentPathProp).replaceAll('\'', '').replaceAll('"', '') : errorComponentPath
          const errorComponentVar = errorComponentPathProp ? 'LazyCustomErrorComponent' : 'errorComponentVar'
          if (errorPath != null) {
            lazyOptions.errorComponent = errorComponentVar
            addImportIfNeeded(scriptSetup, `import ${errorComponentVar} from '${errorPath}'`, imports)
          }

          const assignLazyOption = <T extends string | number | undefined | object>(
            prop: { loc: { start: { offset: number }, end: { offset: number } } } | undefined,
            fallback: T,
            key: string,
            transform: (value: string) => T = v => v as unknown as T,
          ): void => {
            const value = prop ? transform(extractRawValue(template, prop)) : fallback
            if (value != null) {
              lazyOptions[key] = value
            }
          }

          assignLazyOption(delayProp, delay, 'delay', v => Number(cleanValue(v)))
          assignLazyOption(timeoutProp, timeout, 'timeout', v => Number(cleanValue(v)))
          assignLazyOption(priorityProp, priority, 'priority', v => cleanValue(v, '\''))
          assignLazyOption(intersectionObserverProp, intersectionObserver, 'intersectionObserver', v => JSON.parse(cleanValue(v)))
          assignLazyOption(loadDataProp, undefined, 'loadData', v => cleanValue(v, ''))

          const propsAsString = Object.entries(lazyOptions).map(([key, value]) => `${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`).join(', ')

          const tagOpenEnd = template.indexOf('>', node.loc.start.offset) + 1
          const tagCloseStart = template.lastIndexOf('</', node.loc.end.offset)

          const children = template.slice(tagOpenEnd, tagCloseStart)
          const newTag = `<component :is="defineLazyComponent({ ${propsAsString} })">${children}</component>`
          const original = template.slice(node.loc.start.offset, node.loc.end.offset)
          mutatedTemplate = mutatedTemplate.replace(original, newTag)

          needsDefineLazyComponent = true
        }

        if (node.children) {
          node.children.forEach(transformLazyNodes)
        }
      }

      transformLazyNodes(ast)

      let newScriptSetup = scriptSetup
      if (needsDefineLazyComponent && !scriptSetup.includes('defineLazyComponent')) {
        imports.unshift(`import { defineLazyComponent } from 'vue3-lazy-component'`)
      }
      imports.forEach((imp) => {
        if (!newScriptSetup.includes(imp)) {
          newScriptSetup += `\n${imp}`
        }
      })

      const scriptSetupBlock = descriptor.scriptSetup
      const finalCode = code
        .replace(templateBlock.content, mutatedTemplate)
        .replace(scriptSetupBlock?.content ?? '', newScriptSetup)

      return { code: finalCode }
    },
  }
}
