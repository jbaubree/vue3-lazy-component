import type { Plugin } from 'vite'
import { NodeTypes, parse as parseTemplateAST } from '@vue/compiler-dom'
import { parse as parseSFC } from '@vue/compiler-sfc'

interface LazyComponentPluginOptions {
  delay?: number
  timeout?: number
  priority?: 'visible-first' | 'immediate'
  intersectionObserver?: IntersectionObserverInit
  errorComponentPath?: string
  loadingComponentSuffix?: string
}

function getComponentFolderFromScript(script: string, compName: string): string | null {
  const regex = new RegExp(`import\\s+${compName}\\s+from\\s+['"](.+)/[^/]+\\.vue['"]`)
  const match = script.match(regex)
  return match?.[1] ?? null
}
function addImportIfNeeded(code: string, importStatement: string, imports: string[]): void {
  if (!code.includes(importStatement)) {
    imports.push(importStatement)
  }
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

          const errorComponentVar = 'LazyErrorComponent'
          const customErrorComponentVar = 'LazyCustomErrorComponent'

          const lazyOptions: Record<string, string | number> = {
            componentFactory: `() => import('${componentFolder ?? '.'}/${pascalName}.vue')`,
            loadingComponent: skeletonName,
          }

          if (errorComponentPathProp) {
            const errorComponentPathPropVal = template.slice(errorComponentPathProp.loc.start.offset, errorComponentPathProp.loc.end.offset).split('=')[1].replaceAll('"', '')
            lazyOptions.errorComponent = customErrorComponentVar
            addImportIfNeeded(scriptSetup, `import ${customErrorComponentVar} from '${errorComponentPathPropVal}'`, imports)
          }
          else if (errorComponentPath) {
            lazyOptions.errorComponent = errorComponentVar
            addImportIfNeeded(scriptSetup, `import ${errorComponentVar} from '${errorComponentPath}'`, imports)
          }
          if (delayProp) {
            const delayPropVal = Number(template.slice(delayProp.loc.start.offset, delayProp.loc.end.offset).split('=')[1].replaceAll('"', ''))
            lazyOptions.delay = delayPropVal
          }
          else if (delay) {
            lazyOptions.delay = delay
          }
          if (timeoutProp) {
            const timeoutPropVal = Number(template.slice(timeoutProp.loc.start.offset, timeoutProp.loc.end.offset).split('=')[1].replaceAll('"', ''))
            lazyOptions.timeout = timeoutPropVal
          }
          else if (timeout) {
            lazyOptions.timeout = timeout
          }
          if (priorityProp) {
            const priorityPropVal = template.slice(priorityProp.loc.start.offset, priorityProp.loc.end.offset).split('=')[1].replaceAll('"', '\'')
            lazyOptions.priority = priorityPropVal
          }
          else if (priority) {
            lazyOptions.priority = priority
          }
          if (intersectionObserverProp) {
            const intersectionObserverPropVal = template.slice(intersectionObserverProp.loc.start.offset, intersectionObserverProp.loc.end.offset).split('=')[1].replaceAll('"', '')
            lazyOptions.intersectionObserver = JSON.parse(JSON.stringify(intersectionObserverPropVal))
          }
          else if (intersectionObserver) {
            lazyOptions.intersectionObserver = JSON.parse(JSON.stringify(intersectionObserver))
          }
          if (loadDataProp) {
            const loadDataVal = template.slice(loadDataProp.loc.start.offset, loadDataProp.loc.end.offset).split('=')[1].replaceAll('"', '')
            lazyOptions.loadData = loadDataVal
          }

          const propsAsString = Object.entries(lazyOptions)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')

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
