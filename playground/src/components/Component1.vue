<script setup lang="ts">
</script>

<template>
  <div class="flex flex-col gap-2 items-center justify-center w-full h-500px bg-red text-white">
    <div><slot name="before" /></div>
    I am component 1
    <div><slot /></div>
  </div>
</template>
