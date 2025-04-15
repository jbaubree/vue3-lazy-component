import type { Plugin } from 'vite'
import { NodeTypes, parse as parseTemplateAST } from '@vue/compiler-dom'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { addImportIfNeeded, cleanValue, extractRawValue, getComponentFolderFromScript } from './utils'

interface LazyComponentPluginOptions {
  delay?: number
  timeout?: number
  priority?: 'visible-first' | 'immediate'
  intersectionObserver?: IntersectionObserverInit
  errorComponentPath?: string
  loadingComponentSuffix?: string
}

export function lazyComponentPlugin(options: LazyComponentPluginOptions = {}): Plugin {
  const {
    delay,
    timeout,
    priority,
    intersectionObserver,
    errorComponentPath,
    loadingComponentSuffix = 'Skeleton',
  } = options

  return {
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
          const baseName = node.tag.slice(4)
          const pascalName = baseName[0].toUpperCase() + baseName.slice(1)
          const skeletonName = `${pascalName}${loadingComponentSuffix}`
          const componentFolder = getComponentFolderFromScript(scriptSetup, node.tag)
          const loadDataProp = node.props.find((p: Record<string, string>) => [':load-data', ':loadData', 'load-data', 'loadData'].includes(p.rawName || p.name))
          const errorComponentPathProp = node.props.find((p: Record<string, string>) => [':error-component-path', ':errorComponentPath', 'error-component-path', 'errorComponentPath'].includes(p.rawName || p.name))
          const delayProp = node.props.find((p: Record<string, string>) => [':delay', 'delay'].includes(p.rawName || p.name))
          const timeoutProp = node.props.find((p: Record<string, string>) => [':timeout', 'timeout'].includes(p.rawName || p.name))
          const priorityProp = node.props.find((p: Record<string, string>) => [':priority', 'priority'].includes(p.rawName || p.name))
          const intersectionObserverProp = node.props.find((p: Record<string, string>) => [':intersection-observer', 'intersectionObserver'].includes(p.rawName || p.name))

          const lazyOptions: Record<string, string | number | object> = {
            componentFactory: `() => import('${componentFolder ?? '.'}/${pascalName}.vue')`,
            loadingComponent: skeletonName,
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

          const newTag = `<component :is="defineLazyComponent({ ${propsAsString} })" />`

          const original = template.slice(node.loc.start.offset, node.loc.end.offset)
          mutatedTemplate = mutatedTemplate.replace(original, newTag)

          addImportIfNeeded(scriptSetup, `import ${skeletonName} from '${componentFolder ?? '.'}/${skeletonName}.vue'`, imports)

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
