# vue3-lazy-component

[![NPM Version](https://badgen.net/npm/v/vue3-lazy-component)](https://www.npmjs.com/package/vue3-lazy-component)
[![Monthly Downloads](https://badgen.net/npm/dm/vue3-lazy-component)](https://www.npmjs.com/package/vue3-lazy-component)
[![Licence](https://badgen.net/npm/license/vue3-lazy-component)](https://github.com/jbaubree/vue3-lazy-component/blob/main/LICENSE.md)
[![CI](https://github.com/jbaubree/vue3-lazy-component/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jbaubree/vue3-lazy-component/actions/workflows/ci.yml)
[![Coverage](https://github.com/jbaubree/vue3-lazy-component/blob/main/badge.svg)](https://github.com/jbaubree/vue3-lazy-component/tree/main/test)

Vue 3 lazy component system with advanced async control — powered by `defineLazyComponent()` and an optional Vite plugin that auto-transforms `<LazyXxx />` components in your templates.

> ✨ Supports loading/error states, visibility-based loading, priority queue, auto-skeleton fallback, and custom `loadData()` hooks.

---

## Installation

```bash
npm install vue3-lazy-component
```

---

# Part 1: Plugin for Auto-Transforming `<LazyXxx />` Tags

## Setup with Vite

```ts
// vite.config.ts
import { lazyComponentPlugin } from 'vue3-lazy-component'

export default {
  plugins: [
    lazyComponentPlugin({
      delay: 200,
      timeout: 10000,
      priority: 'visible-first',
      loadingComponentSuffix: 'Skeleton',
      errorComponentPath: '@/components/common/GenericError.vue',
    }),
  ],
}
```

### Plugin Options

| Option                    | Type                           | Default        | Description |
|---------------------------|--------------------------------|----------------|-------------|
| `delay`                  | `number`                       | `0`            | Delay before showing loading component (in ms) |
| `timeout`                | `number`                       | `Infinity`     | Timeout before triggering error UI (in ms) |
| `priority`               | `'visible-first' \| 'immediate'` | `'visible-first'` | Load strategy |
| `intersectionObserver`   | `IntersectionObserverInit`     | `{}`           | Observer options |
| `errorComponentPath`     | `string`                       | `undefined`    | Global error fallback component path |
| `loadingComponentSuffix` | `string`                       | `'Skeleton'`   | Auto-detect loading component with suffix |

---

### Usage Example

```vue
<script setup>
function loadUser() {
  return fetch('/api/user').then(r => r.json())
}
</script>

<template>
  <LazyUserCard
    :load-data="loadUser"
    delay="300"
    timeout="8000"
    priority="immediate"
    error-component-path="@/components/errors/CustomError.vue"
  />
</template>
```

### `<LazyXxx />` Props

| Prop                     | Type                              | Default        | Description |
|--------------------------|-----------------------------------|----------------|-------------|
| `load-data`              | `() => Promise<any>`              | `undefined`    | Hook called after component is loaded |
| `error-component-path`   | `string`                          | `undefined`    | Override global error component |
| `delay`                  | `number`                          | `0` or plugin value | Local delay override |
| `timeout`                | `number`                          | `Infinity` or plugin value | Local timeout override |
| `priority`               | `'visible-first' \| 'immediate'` | `'visible-first'` or plugin value | Local load strategy |
| `intersection-observer` | `IntersectionObserverInit`       | `{}` or plugin value | Local observer options |

---

# Part 2: Manual Usage with `defineLazyComponent`

You can also use `defineLazyComponent()` directly in your `setup()`:

```vue
<script setup>
import { defineLazyComponent } from 'vue3-lazy-component'

const UserCard = defineLazyComponent({
  componentFactory: () => import('@/components/UserCard.vue'),
  loadingComponent: () => import('@/components/UserCardSkeleton.vue'),
  errorComponent: () => import('@/components/UserCardError.vue'),
  loadData: () => fetch('/api/user').then(r => r.json()),
  delay: 200,
  timeout: 5000,
  priority: 'visible-first',
  intersectionObserver: { rootMargin: '200px' },
})
</script>

<template>
  <component :is="UserCard" />
</template>
```

### `defineLazyComponent` Options

| Option                 | Type                              | Default        | Description |
|------------------------|-----------------------------------|----------------|-------------|
| `componentFactory`     | `() => Promise<Component>`        | **Required**   | Async component import |
| `loadData`             | `() => Promise<any>`              | `undefined`    | Optional hook for fetching external data |
| `loadingComponent`     | `Component \| () => Promise<Component>` | `undefined`    | Optional skeleton/loading UI |
| `errorComponent`       | `Component \| () => Promise<Component>` | `undefined`    | Optional error UI |
| `delay`                | `number`                          | `0`            | Delay before showing loading component |
| `timeout`              | `number`                          | `Infinity`     | Timeout before showing error component |
| `priority`             | `'visible-first' \| 'immediate'` | `'visible-first'` | Loading priority |
| `intersectionObserver` | `IntersectionObserverInit`       | `{}`           | Observer options (rootMargin, threshold, etc.) |

---

## Why use vue3-lazy-component?

- ✅ Lazy loading based on visibility
- ✅ Optional skeleton & error UI
- ✅ `loadData()` hook with async queue
- ✅ Zero-runtime if you use vite plugin
- ✅ Seamless fallback to `defineAsyncComponent`

---

## Known Limitations / TODO

- ⚠️ Only supports `<script setup>` files for plugin mode
- ❌ Slots are not passed through yet
- 🧪 Tests WIP
- 🧱 SSR not yet supported

---

## License

MIT
