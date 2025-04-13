<script setup lang="ts">
import LazyComponent1 from '@/components/Component1.vue'
import LazyComponent2 from '@/components/Component2.vue'
import LazyComponent3 from '@/components/Component3.vue'
import LazyComponent4 from '@/components/Component4.vue'
import LazyComponent5 from '@/components/Component5.vue'

function loadData() {
  return new Promise((resolve) => {
    setTimeout(resolve, 3000)
  })
}
function loadWithError() {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      // eslint-disable-next-line prefer-promise-reject-errors
      reject('Promise rejected')
    }, 3000)
  })
}
</script>

<template>
  <div class="p-5 flex flex-col gap-5">
    <LazyComponent1 :load-data="loadData" />
    <LazyComponent2 :load-data="loadData" />
    <LazyComponent3 :load-data="loadWithError" />
    <LazyComponent4 :load-data="loadWithError" error-component-path="@/components/Error.vue" />
    <LazyComponent5 :load-data="loadData" priority="immediate" />
  </div>
</template>
