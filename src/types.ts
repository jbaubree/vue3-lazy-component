/**
 * Vite Plugin options.
 */
export interface VitePluginOptions {
  /**
   * Delay before showing the loading component in ms.
   * Example: 100
   * @default 0
   */
  delay?: number
  /**
   * The error component will be displayed if a timeout is provided and exceeded.
   * Example: 10_000
   * @default undefined
   */
  timeout?: number
  /**
   * Component loading priority. Immediate to load components on app load.
   * @default 'visible-first'
   */
  priority?: 'visible-first' | 'immediate'
  /**
   * Intersection observer options for 'visible-first' priority
   * @default undefined
   */
  intersectionObserver?: IntersectionObserverInit
  /**
   * Default error component path.
   * Example: '@/components/DefaultErrorComponent.vue'
   * @default undefined
   */
  errorComponentPath?: string
  /**
   * Suffix for loading component auto detect.
   * For Header.vue component, you can create HeaderSkeleton.vue and it will be auto imported.
   * Example: 'Loader'
   * @default 'Skeleton'
   */
  loadingComponentSuffix?: string
  /**
   * unplugin-vue-components Auto-import declaration file path to overwrite with Lazy options.
   * @default './components.d.ts'
   */
  dtsPath?: string
}
