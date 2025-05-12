<script setup lang="ts">
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
    <LazyComponent1 foo="AZE" :load-data="loadData">
      <template #before>
        slot before
      </template>
      slot after
    </LazyComponent1>
    <LazyComponent2 :load-data="loadData" />
    <LazyComponent3 :load-data="loadWithError" />
    <LazyComponent4 :load-data="loadWithError" error-component-path="@/components/Error.vue" />
    <LazyComponent5 :load-data="loadData" priority="immediate" />
  </div>
</template>
