<script setup>
/**
 * MiniBar.vue — Barra de progreso miniatura de composición.
 * Props: segments [{ pct, color }]
 */
defineProps({
    segments: {
        type: Array,
        default: () => []
    }
});
</script>

<template>
    <div class="mini-bar-container">
        <span
            v-for="(seg, i) in segments"
            :key="i"
            class="mini-bar-segment"
            :style="{ width: `${seg.pct}%`, background: seg.color }"
        />
    </div>
</template>

<style scoped>
.mini-bar-container {
    width: 110px;
    height: 12px;
    margin: 0 auto;
    border-radius: 999px;
    overflow: hidden;
    background: #e8eee9;
    display: flex;
    box-shadow: inset 0 0 0 1px rgba(15, 31, 22, 0.08);
}

.mini-bar-segment {
    height: 100%;
    display: block;
    flex-shrink: 0;
}
</style>
