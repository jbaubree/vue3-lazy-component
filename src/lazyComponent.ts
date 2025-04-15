import type { Component } from 'vue'
import { computed, defineAsyncComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

export const lazyComponentQueue = reactive<Record<string, {
  loadCallback: () => void
  isLoading: boolean
}>>({})

export function removeFromQueue(uid: string): void {
  delete lazyComponentQueue[uid]
}

export function triggerRemainingLazyLoads(): void {
  const anyStillLoading = Object.values(lazyComponentQueue).some(({ isLoading }) => isLoading)
  if (!anyStillLoading) {
    Object.entries(lazyComponentQueue).forEach(([uid, { loadCallback, isLoading }]) => {
      if (!isLoading) {
        loadCallback()
        removeFromQueue(uid)
      }
    })
  }
}

export function defineLazyComponent<T extends Component>({
  componentFactory,
  loadData,
  loadingComponent,
  errorComponent = loadingComponent,
  delay = 0,
  timeout,
  priority = 'visible-first',
  intersectionObserver = {
    rootMargin: '0px',
    threshold: 0,
    root: null,
  },
}: {
  componentFactory: () => Promise<T>
  delay?: number
  errorComponent?: Component
  loadData?: () => Promise<unknown>
  loadingComponent: Component
  timeout?: number
  priority?: 'visible-first' | 'immediate'
  intersectionObserver: IntersectionObserverInit
}): T {
  let resolveAsyncComponent: (value: T | PromiseLike<T>) => void

  return defineAsyncComponent({
    loader: () => new Promise<T>((resolve) => {
      resolveAsyncComponent = resolve
    }),
    loadingComponent: {
      setup() {
        const uid = ref<string>()
        const hasError = ref<unknown>(null)
        const wrapperRef = ref<HTMLElement | null>(null)
        const observerRef = ref<IntersectionObserver | null>(null)

        const isErrored = computed(() => !!hasError.value)

        const loadComponent = async (): Promise<void> => {
          if (!uid.value || !lazyComponentQueue[uid.value])
            return
          try {
            lazyComponentQueue[uid.value].isLoading = true
            const component = await componentFactory()
            if (loadData)
              await loadData()

            removeFromQueue(uid.value)
            resolveAsyncComponent(component)
            resolveAsyncComponent = () => null
            triggerRemainingLazyLoads()
          }
          catch (err) {
            hasError.value = err
            removeFromQueue(uid.value)
            console.warn(`[defineLazyComponent] Failed to load ${uid.value}`, err)
            triggerRemainingLazyLoads()
          }
        }

        onMounted(() => {
          const instance = getCurrentInstance()
          uid.value = instance?.uid.toString()

          if (!uid.value || !wrapperRef.value)
            return

          lazyComponentQueue[uid.value] = {
            loadCallback: loadComponent,
            isLoading: false,
          }

          if (priority === 'immediate') {
            loadComponent()
            return
          }

          const observer = new IntersectionObserver((entries) => {
            entries.forEach(({ intersectionRatio, target }) => {
              const targetUid = (target as HTMLElement).dataset.element
              if (!targetUid || intersectionRatio <= 0)
                return

              const entry = lazyComponentQueue[targetUid]
              if (!entry || entry.isLoading)
                return

              entry.loadCallback()
              observer.unobserve(target)
            })
          }, { ...intersectionObserver })

          observer.observe(wrapperRef.value)
          observerRef.value = observer
        })

        onBeforeUnmount(() => {
          if (wrapperRef.value && observerRef.value) {
            observerRef.value.unobserve(wrapperRef.value)
          }
          if (uid.value) {
            removeFromQueue(uid.value)
          }
        })

        return () =>
          isErrored.value
            ? h(errorComponent, { error: hasError.value })
            : h('div', { 'ref': wrapperRef, 'data-element': uid.value }, [h(loadingComponent)])
      },
    },
    delay,
    errorComponent,
    timeout,
  })
}
